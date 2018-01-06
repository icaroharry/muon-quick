/* global chrome PKT_EXT */
(function(PKT_EXT){

    var showStateSaved  = function(urlToSave, itemID, features, saveType) {
        PKT_EXT.ERROR.closeError()
        PKT_EXT.SAVE.saveURL( urlToSave, itemID, features, saveType)
    }


    var showStateError  = function() {
        PKT_EXT.SAVE.closeSave()
        PKT_EXT.ERROR.saveError(PKT_EXT.TRANS['page_not_saved'], PKT_EXT.TRANS['page_not_saved_detail'])
    }

    var showStateUnauthorized  = function() {
        PKT_EXT.SAVE.closeSave()
        PKT_EXT.ERROR.saveError(PKT_EXT.TRANS['server_error'], PKT_EXT.TRANS['server_error_detail'])
    }

    var showSaveReminder  = function(isVideo) {
        PKT_EXT.SAVE.closeSave()
        PKT_EXT.REMINDER.saveReminder(isVideo)
    }

    var addMessageListener = function(){
        chrome.runtime.onMessage.addListener(handleMessageResponse)
    }

    var runExperiment = function(request) {
        PKT_EXT.EXPERIMENT.messageReceived(request)
    }

    var handleMessageResponse = function(request) {
        switch(request.status){

            case 'success':
                showStateSaved(request.features.url, request.item_id, request.features, request.saveType)
                break

            case 'unauthorized':
                showStateUnauthorized()
                break

            case 'error':
                showStateError()
                break

            case 'expermiment':
                runExperiment(request)
                break

        }

        return true

    }

    var checkReminder = function(){
        var contentType = document.querySelector('[property="og:type"]')
        if( contentType && contentType.content == 'article'){
            showSaveReminder()
        }
        if( contentType && contentType.content == 'video'){
            showSaveReminder(true)
        }
    }

    if(!(/chrome\/newtab/).test(document.location.href)) {
        addMessageListener(handleMessageResponse)
    }

    document.addEventListener('DOMContentLoaded', function(){
        checkReminder()
    })


}(PKT_EXT || {}))
