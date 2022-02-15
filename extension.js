'use strict';

const extension = {};
window.extension = extension;

window.ReplaceRule = {
    createNew: function () {
        return {
            checked: false,
            name: '',
            description: '',
            filename:'',
            filetype:'',
            regexurl: '',
            replaceurl:'',
            filecontent:'',
            ruletype: RuleType.FILE_STORAGE,
            regextype: RegexType.NONE,
        }
    }
}

const ButtonType = {
    ADD: 'add',
    INJECT: 'inject',
    CHANGE: 'change'
}

const RuleType = {
    COMMON:'common',//普通的http https
    FILE_LOCATION:'file_location',//存储在PC的文件
    FILE_STORAGE:'file_storage',//存储在storage里面的文件
}

const RegexType = {
    SIMPLE:'simple',
    LOOK_AROUND:'look_around',
    NONE:'none',
}

var FileTypeMap = {
    "txt": "text/plain",
    "html": "text/html",
    "css": "text/css",
    "js": "text/javascript",
    "json": "text/json",
    "xml": "text/xml",
    "jpg": "image/jpeg",
    "gif": "image/gif",
    "png": "image/png",
    "webp": "image/webp"
}


/* 在这里加载运行时，设定 */
extension.runtime = {
    /**
     * 监听chrome.runtime的事件
     * @param {string} e 
     * @param {function} callback 
     */
    on(e, callback) {
        switch (e) {
            case 'startup':
                chrome.runtime.onStartup.addListener(callback);
                // chrome.runtime.onInstalled.addListener(callback);
                break;
            case 'message':
                chrome.runtime.onMessage.addListener(callback);
                //onmessage必须是contentscript或者popup发来的信息，否则无法告知我已经
                break;
            case 'connect':
                chrome.runtime.onConnect.addListener(callback);
                break;
            case 'install':
                chrome.runtime.onInstalled.addListener(callback);
                break;
            default:
                console.log("theres no such kind of runtime:", e);
        };
    },

    /**
     * 得到当前插件的manifest
     */
    get manifest() {
        return chrome.runtime.getManifest();
    },

    /**
     * 得到当前extension的基础地址
     * @param {string} path 
     */
    buildURL(path) {
        return chrome.runtime.getURL(path);
    },

    /**
     * 连接tab
     * @param {number} tabId 
     * @param {any} connectInfo 
     * @returns 
     */
    connect(tabId, connectInfo) {
        let port;
        if (typeof tabId === 'object') {
            port = chrome.runtime.connect(tabId);
        }
        else {
            port = chrome.tabs.connect(tabId, connectInfo);
        }
        return {
            on(e, callback) {
                if (e === 'message') {
                    port.onMessage.addListener(callback);
                }
            },
            post(msg) {
                port.postMessage(msg);
            }
        };
    }
};

/* extension操作存储相关的方法 */
extension.storage = {
    /**
     * 获得存储
     * @param {object} prefs 存储的对象
     * @param {string} type 存储的地方sync|local，默认local
     * @returns Promise
     */
    get(prefs, type = 'local') {
        return new Promise((resolve,reject) => {
            chrome.storage[type === 'sync' ? 'sync' : 'local'].get(prefs, (items) => {
                if (chrome.runtime.lastError) {
                  return reject(chrome.runtime.lastError);
                }
                resolve(items);
              });
        });
    },
    /**
     * 设置存储
     * @param {object} prefs 存储的对象
     * @param {string} type 存储的地方sync|local，默认local
     * @returns Promise
     */
    set(prefs, type = 'local') {
        return new Promise((resolve,reject) => {
            chrome.storage[type === 'sync' ? 'sync' : 'local'].set(prefs, ()=>{
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                  }
            });
        });
    },
    /**
     * 发生改变事监听
     * @param {string} e 
     * @param {function} callback 
     */
    on(e, callback) {
        if (e === 'changed') {
            chrome.storage.onChanged.addListener(callback);
        }
    }
};

extension.button = {
    set({ popup }, tabId) {
        if (popup !== undefined) {
            chrome.browserAction.setPopup({ tabId, popup });
        }
    },
    on(e, callback) {
        if (e === 'clicked') {
            chrome.browserAction.onClicked.addListener(callback);
        }
    }
};

/* extension关于开启新的标签页，向指定标签页注入代码，向content-script */
extension.tabs = {
    
    open({ url }) {
        return new Promise(resolve => chrome.tabs.create({ url }, resolve));
    },

    /**
     * 返回当前tab的id编号
     * @returns Promise
     */
    current() {
        return new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, (tabs = []) => resolve(tabs[0])));
    },
    /**
     * 获得当前window，可能是另一个窗体
     * @param {function} callback 回调函数
     * @returns Promise
     */
    getCurrentWindow(callback) {
        return chrome.windows.getCurrent(e => callback(e));
    },
    getCurrentTab(callback) {
        return chrome.windows.getCurrent(function (currentWindow) {
            chrome.tabs.query({ active: true, windowId: currentWindow.id }, function (tabs) {
                //还有一种情况，tabs未定义为空
                if (callback) callback(tabs.length ? tabs[0] : null);
            });
        });
    },
    getCurrentTabId(callback) {
        //将函数执行
        return chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (callback) callback(tabs.length ? tabs[0].id : null);
        });
    },
    /**
     * 针对隐藏状态下的，这个很重要是因为currentwindow:true有时会失效
     * @param {function} callback 
     * @returns Promise
     */
    getCurrentTabId2(callback) {
        return chrome.windows.getCurrent(function (currentWindow) {
            chrome.tabs.query({ active: true, windowId: currentWindow.id }, function (tabs) {
                if (callback) callback(tabs.length ? tabs[0].id : null);
            });
        });
    },
    getCurrentTabUrl(callback) {
        // chrome.tabs.query({active:true,currentWindow:true},(tabs)=>console.log(tabs[0]));
        return chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            console.log(tabs);
            if (callback) callback(tabs.length ? tabs[0].url : null);
        });
    },
    getCurrentTabUrl2(callback) {
        return chrome.windows.getCurrent(function (currentWindow) {
            chrome.tabs.query({ active: true, windowId: currentWindow.id }, function (tabs) {
                if (callback) callback(tabs.length ? tabs[0].url : null);
                // else return tabs.length ? tabs[0].url : null;
                //这个问题涉及到闭包的本质
                //TODO 2021-09-14 10:51:20
                // 有些方法是异步的，有些方法不是，要区分一下
            });
        });
    },
    inject: {
        js(tabId, details) {
            if (typeof tabId === 'object') {
                details = tabId;
                tabId = undefined;
            }
            return new Promise((resolve, reject) => {
                chrome.tabs.executeScript(tabId, Object.assign({
                    runAt: 'document_start',
                    allFrames: true,
                }, details), results => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        reject(lastError);
                    }
                    else {
                        resolve(results);
                    }
                });
            });
        },
        css(tabId, details) {
            if (typeof tabId === 'object') {
                details = tabId;
                tabId = undefined;
            }
            return new Promise((resolve, reject) => {
                chrome.tabs.insertCSS(tabId, Object.assign({
                    runAt: 'document_start'
                }, details), results => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        reject(lastError);
                    }
                    else {
                        resolve(results);
                    }
                });
            });
        }
    }
};

/* 打开另一个窗体 */
extension.windows = {
    /**
     * 打开窗体
     * @param {object} param0 窗体打开的一些定义
     * @returns Promise
     */
    open({ url, left, top, width, height, type }) {
        width = width || 700;
        height = height || 500;
        if (left === undefined) {
            left = screen.availLeft + Math.round((screen.availWidth - width) / 2);
        }
        if (top === undefined) {
            top = screen.availTop + Math.round((screen.availHeight - height) / 2);
        }
        return new Promise(resolve => chrome.windows.create(
            { url, width, height, left, top, type: type || 'popup' },
            resolve
        ));
    }
};

/* extension操作右键contenxtmenu的增加等方法 */
extension.menus = {
    /**
     * 操作menus
     * @param  {...any} items 对象
     */
    add(...items) {
        for (const item of items) {
            chrome.contextMenus.create(Object.assign({ contexts: item.contexts || ['browser_action'] }, item));
        }
    },
    on(e, callback) {
        if (e === 'clicked') {
            chrome.contextMenus.onClicked.addListener(callback);
        }
    }
};

extension.i18n ={
    translate(message){
        return chrome.i18n.getMessage(message);
    }
}