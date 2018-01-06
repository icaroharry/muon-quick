(function(PKT_EXT) {
    var passedtab = null;
    var storedList = null;
    var storedArticle = null;
    var baseHost = 'getpocket.com',
        baseURL = 'https://' + baseHost;

/*==========================================================================
= TOOLBAR ICON MANIPULATION: LIFTED FROM BACKGROUND.JS                     =
===========================================================================*/

    function showToolbarIcon(tabId, iconName) {
        // Change toolbar icon to new icon
        var smallIconPath, bigIconPath

        if(isEdge()){
            smallIconPath = 'app/images/' + iconName + '-20.png'
            bigIconPath = 'app/images/' + iconName + '-40.png'
            chrome.browserAction.setIcon({
                tabId: tabId,
                path: {
                    '20': smallIconPath,
                    '40': bigIconPath
                }
            })
        }else{
            smallIconPath = 'app/images/' + iconName + '-19.png'
            bigIconPath = 'app/images/' + iconName + '-38.png'
            chrome.browserAction.setIcon({
                tabId: tabId,
                path: {
                    '19': smallIconPath,
                    '38': bigIconPath
                }
            })
        }
    }

    function showNormalToolbarIcon(tabId) {
        showToolbarIcon(tabId, 'browser-action-icon')
    }

    function showSavedToolbarIcon(tabId) {
        showToolbarIcon(tabId, 'browser-action-icon-added')
    }

/*===============================
= API Calls and Callbacks       =
===============================*/

    function getList() {
        // We're on the same page, no need to fetch
        if (storedList && storedArticle && storedArticle.item_preview.resolved_url === passedtab.url) {
            chrome.tabs.sendMessage(passedtab.id, {status: 'expermiment', type: 'getList', data: storedList })
            return;
        }

        PKT_EXT.API.getList({
            success: function(data) {
                if (data.list.length === 0) data.list = {};
                storedList = data;
                chrome.tabs.sendMessage(passedtab.id, {status: 'expermiment', type: 'getList', data: data })
            },
            error: function() {
                if (storedList) {
                    chrome.tabs.sendMessage(passedtab.id, {status: 'expermiment', type: 'getList', data: storedList })
                } else {
                    chrome.tabs.sendMessage(passedtab.id, {status: 'expermiment', type: 'getList', data: { error: true } })
                }
            }
        });
    }

    function getArticleInfo(url) {
        // We're on the same page, no need to fetch
        if (storedArticle && storedArticle.item_preview.resolved_url === passedtab.url) {
            chrome.tabs.sendMessage(passedtab.id, {status: 'expermiment', type: 'getArticleInfo', data: storedArticle });
            return;
        }

        PKT_EXT.API.getArticleInfo({
            url: url,
            success: function(data) {
                storedArticle = data;
                storedArticle.item_preview.sort_id = -1; // Adding sort as negative so it'll appear at top once pushed to saved list
                storedArticle.item_preview.resolved_title = data.item_preview.title;
                storedArticle.item_preview.newly_saved = true;
                storedArticle.item_preview.has_image = (data.item_preview.top_image_url) ? 1 : 0;
                storedArticle.item_preview.images = { 1: { src: data.item_preview.top_image_url }};

                chrome.tabs.sendMessage(passedtab.id, {status: 'expermiment', type: 'getArticleInfo', data: data });
            },
            error: function() {
                var data = {
                    title: passedtab.title,
                    host: new URL(passedtab.url).hostname
                };
                chrome.tabs.sendMessage(passedtab.id, {status: 'expermiment', type: 'getArticleInfo', data: data });
            }
        });
    }

    function twoClickSaveArticle(tab, options, featureSet) {
        var title           = options.title || tab.title || ''
        var url             = options.url || tab.url  || ''
        var saveType        = options.saveType || 'page'
        var showSavedIcon   = (typeof options.showSavedIcon !== 'undefined') ? options.showSavedIcon : true

        featureSet.url = url

        // Add the url to Pocket
        PKT_EXT.API.add(title, url, {
            actionInfo: options.actionInfo,
            success: function(data) {
                var itemid = null
                if (typeof data.action_results
                    && data.action_results.length
                    && typeof data.action_results[0]) {
                    itemid = data.action_results[0].item_id
                }

                onSaveSuccess(tab, showSavedIcon, itemid, saveType, featureSet)
            },
            error: function(status, xhr) {
                // Not authorized
                if (status === 401) {
                    sendMessageToTab(tab, {'status': 'unauthorized'})
                    authentication.showLoginWindow(function() { twoClickSaveArticle(tab, options) })
                    return
                }

                // Handle error message
                onSaveError(tab, xhr)

                // Error callback
                if (options.error) { options.error(status, xhr) }
            }
        })
    }

    function onSaveSuccess(tab, showToolbarIcon, itemId, saveType, featureSet) {
        if (typeof showToolbarIcon !== 'undefined' && showToolbarIcon === true) {
            showSavedToolbarIcon(tab.id)
        }

        featureSet.savecount += 1
        setSetting('saveCount', featureSet.savecount)

        if (storedList) {
            storedList.list[storedArticle.item_preview.resolved_id] = storedArticle.item_preview;
            featureSet.saveList = storedList;
        }

        // Only display saved list, not recs -- commented code may come in handy should this become a permanent feature
        // featureSet.twoclick = (boolFromString(getSetting('show_chrome_two_click')) && !boolFromString(getSetting('recommendations')));
        // featureSet.recs = (getSetting('recommendations') === 'true' && getSetting('show_recs') === 'true')
        // featureSet.twoclick = true;
        // featureSet.recs = false;
        // chrome.tabs.sendMessage(tab.id, {status: 'success', item_id: itemId, features: featureSet, saveType: saveType })
        chrome.tabs.sendMessage(tab.id, {status: 'expermiment', type: 'articleSaved', item_id: itemId, features: featureSet, saveType: saveType });

    }

    function onSaveError(tab, xhr) {
        // Handle error message
        var errorMessage = xhr.getResponseHeader('X-Error')
        errorMessage = (errorMessage === null || typeof errorMessage === 'undefined') ?
            PKT_EXT.i18n.getMessage('background_save_url_error_no_message') : PKT_EXT.i18n.getMessagePlaceholder('background_save_url_error_message', [errorMessage])

        sendMessageToTab(tab, { status: 'error', message: errorMessage })
    }

    function removeLinkFromPocket() {
        storedList = null;
        storedArticle = null;
    }

    function disableTwoClick() {
        setSetting('twoclick', 'false')
    }

    function sendAnalytics(ctx, callback) {
        PKT_EXT.API.sendExperimentAnalytics(ctx, callback)
    }

/*===============================
=          Experiments          =
===============================*/

    function twoClickExperiement(url) {
        if (url.indexOf('https://getpocket.com') !== -1) {
            chrome.tabs.update(passedtab.id, {url: baseURL})
            return
        }

        var reusePanel = storedArticle && storedArticle.item_preview.resolved_url == url;

        chrome.tabs.sendMessage(passedtab.id, {status: 'expermiment', type: 'prepareExperiment', data: { reusePanel: reusePanel } });

        getArticleInfo(url);
        getList();

        sendAnalytics({
            action: 'pv_wt',
            view: 'extension',
            section: 'two_click',
            identifier: 'click',
        })
    }

    function twoClickExperimentShouldRun() {
        return (boolFromString(getSetting('show_chrome_two_click')) && isChromeOnly())
    }

/*===============================
=            Actions            =
===============================*/

    function checkForExperiment(stage, tab) {
        passedtab = tab;

        switch(stage) {
            case 'saveLinkToPocket':
                // Checking for in saveLinkToPocket() in background.js
                return {
                    shouldRun: twoClickExperimentShouldRun(),
                    runExperiment: twoClickExperiement
                }
        }
    }

    function messageHandler(request, tab, callback, featureSet) {
        passedtab = tab

        switch(request.type) {
            case 'saveLinkToPocket':
                // Sent from experiments/twoclicksave panel
                return twoClickSaveArticle(tab, request, featureSet)

            case 'removeLinkFromPocket':
                // Sent from experiments/twoclicksave panel
                return removeLinkFromPocket()

            case 'archiveLinkFromPocket':
                // Sent from experiments/twoclicksave panel
                return removeLinkFromPocket()

            case 'disableTwoClick':
                // Sent from experiments/twoclicksave panel
                return disableTwoClick()

            case 'sendAnalytics':
                return sendAnalytics(request.ctx, callback)
        }
    }

    PKT_EXT.EXPERIMENT_RUNNER = {
        checkForExperiment: checkForExperiment,
        messageHandler: messageHandler,
    }

}(PKT_EXT || {}))
