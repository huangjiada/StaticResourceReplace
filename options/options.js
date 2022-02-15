'use strict';
window.extension = chrome.extension.getBackgroundPage().extension;
window.ReplaceRule = chrome.extension.getBackgroundPage().ReplaceRule;

const fileReader = FileReaderPromise();

const ButtonType = {
  ADD: 'add',
  INJECT: 'inject',
  CHANGE: 'change'
}
const app = new Vue({
  el: '#app',
  data: {
    message: 'Hello Vue!',
    items: [],
    editBoxButtonType: '',
    editBoxDisplay: false,
    injectBoxDisplay: false,
    loadingDisplay: true,
    inputError: '',
    previousItem: window.ReplaceRule.createNew(),
    currentItem: window.ReplaceRule.createNew(),
  },
  created: async function () {
    let { rules } = await extension.storage.get({ rules: [] });
    this.items = rules;
    this.loadingDisplay = false;
  },
  methods: {
    fastAdd: function () {
      console.log("Add");
      this.currentItem = window.ReplaceRule.createNew();
      this.currentItem.description = 'created by pupup';
      this.editBoxButtonType = ButtonType.ADD;
      this.editBoxDisplay = true;
    },
    hideEditBox: function () {
      console.log("hideEditBox")
      this.editBoxDisplay = false;
    },
    changeItem: async function () {
      this.editBoxDisplay = false;
      this.preItem.regexurl = this.currentItem.regexurl;
      this.preItem.filecontent = this.currentItem.filecontent;
      this.preItem.filename = this.currentItem.filename;
      this.preItem.name = this.currentItem.name;
      await extension.storage.set({ rules: this.items });
    },
    saveItem: async function () {
      this.editBoxDisplay = false;
      this.items.push(this.currentItem);
      await extension.storage.set({ rules: this.items });
    },
    editRule: function (item) {
      this.editBoxButtonType = ButtonType.CHANGE;
      this.editBoxDisplay = true;
      this.currentItem = Object.assign({}, item);
      this.preItem = item;
    },
    removeRule: async function (item, index) {
      if (this.items)
        this.items.splice(index, 1);
      await extension.storage.set({ rules: this.items });
      let { rules } = await extension.storage.get({ rules: [] });
      this.items = rules;
    },
    checkRule: async function (item, index) {
      await extension.storage.set({ rules: this.items });
    },
    buttonClick: async function (event) {
      switch (this.editBoxButtonType) {
        case ButtonType.ADD:
          await this.saveItem();
          break;
        case ButtonType.CHANGE:
          await this.changeItem();
          break;
        default:
          throw Error("不支持的类型");
      };
    },
    readFile: async function (event) {
      // event.stopPropagation();
      event.preventDefault();
      let files = event.dataTransfer.files;
      if (files.length == 0) {
        return;
      }
      let content = await fileReader.readAsText(files[0]);
      this.currentItem.filecontent = content;
      this.currentItem.filename = files[0].name;
      this.currentItem.name = files[0].name;
    },
    exportBatch: function (event) {
      //批量导出
      var blob = new Blob([JSON.stringify(this.items, null, '\t')], { type: "text/json;charset=utf-8" });
      saveAs(blob, "StaticFileReplace.json");
    },
    importBatch: async function (event) {
      event.preventDefault();
      var files = event.target.files;
      if (files && files[0]) {
        var result = await fileReader.readAsText(files[0]);
        var data = JSON.parse(result);
        for (var i = 0, len = data.length; i < len; i++) {
          this.items.push(data[i]);
        }
        await extension.storage.set({ rules: this.items });
      }
    }
  }
});