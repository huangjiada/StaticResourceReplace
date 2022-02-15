var ReplaceRuleArray = [];
//内容直接存储到background，所以异步直接读取就好了
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

extension.storage.on('changed', change => ReplaceRuleArrayChanged(change));

extension.runtime.on('startup',async ()=> {
    let { rules } = await extension.storage.get({ rules: [] });
    ReplaceRuleArray= rules;
});

//将字符串转化为dataurl，返回给网络请求
function content2DataURL(content, filetype) {
    var result = encodeURIComponent(
        filetype === 'js' ?//如果是js，要对里面的unicode字符要特殊转换，其实css也要的吧，感觉没关系吧
            content.replace(/[\u0080-\uffff]/g, function ($0) {
                var str = $0.charCodeAt(0).toString(16);
                return "\\u" + '00000'.substr(0, 4 - str.length) + str;
            }) : content
    );
    return ("data:" + (FileTypeMap[filetype] || FileTypeMap.txt) + ";charset=utf-8," + result);
}

function getLocalFileContent(url) {
    var arr = url.split('.');
    //要剔除url parameter，能否剔除正则表达？
    var type = arr[arr.length - 1];
    var xhr = new XMLHttpRequest();
    xhr.open('get', url, false);
    xhr.send(null);
    var content = xhr.urlponseText || xhr.urlponseXML;
    if (!content) {
        return false;
    }
    return content2DataURL(content, type);
}

function ReplaceRuleArrayChanged(change) {
    ReplaceRuleArray = change.rules.newValue;
    console.log("ReplaceRuleArray Changed:", ReplaceRuleArray);
}

function replaceMathod (details) {
    let sourceurl = details.url;
    for (let i = 0, len = ReplaceRuleArray.length; i < len; i++) {
        //对存储的规则逐一调用正则表达式检查
        let reg = new RegExp(ReplaceRuleArray[i].regexurl, 'gi');
        if (ReplaceRuleArray[i].checked && ReplaceRuleArray[i].regexurl && reg.test(sourceurl)) {
            // return { redirectUrl: content2DataURL(ReplaceRuleArray[i].filecontent, ReplaceRuleArray[i].filetype) };
            switch (ReplaceRuleArray[i].ruletype) {
                case 'common':
                    var result = getURLFromRegex(reg, ReplaceRuleArray[i].replaceurl, ReplaceRuleArray[i].regextype)
                    return { redirectUrl: result ? result : false };
                case 'file_location':
                    var result = getURLFromRegex(reg, ReplaceRuleArray[i].replaceurl, ReplaceRuleArray[i].regextype);
                    return { redirectUrl: result ? getLocalFileContent(result) : false };
                case 'file_storage':
                    // stroage文件替换必定不会使用正则，因为每次只会替换一个文件
                    // console.log("file_storage replace happen",ReplaceRuleArray[i]);
                    return { redirectUrl: content2DataURL(ReplaceRuleArray[i].filecontent, ReplaceRuleArray[i].filetype) };
                default:
                    throw error('unsupport rule type:', ReplaceRuleArray[i].ruletype);
            }
        }
    }
    return;
};


function getURLFromRegex(reg, replaceurl, regextype) {
    switch (regextype) {
        case 'none':
            //无正则类型，则直接返回
            return replaceurl;
        case "common":
            //普通正则，把正则的部分替换为别的地址
            return (reg.source.replace(reg, replaceurl));//common 简单替换，将正则匹配到的替换成新的
        case "look_around":
            //零宽断言，提取正则的部分组合为最终的地址
            let matchs = reg.source.match(reg);  //lookaround 零宽断言替换，将正则匹配到的放在新的末尾
            return (replaceurl + matchs[0]);
        default:
            return;
    }
}

const handler = chrome.webRequest.onBeforeRequest.addListener(
    replaceMathod,
    {
        urls: ["<all_urls>"],//过滤的url
        // urls: ["*://*/*"],//只过滤https和http
        // types: ["main_frame"]//只对主要frame，次级frame将不会监听
        //考虑到是针对不论哪个frame的，所以都要替换
    },
    ["blocking"]//监听的结果是中止掉之前的url访问，在方法中替换为
);

