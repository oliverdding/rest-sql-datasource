import './css/query-editor.css!'

import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import sqlPart from './sql_part';
import { PanelEvents } from '@grafana/data';


export class RestSqlDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector, uiSegmentSrv, $q) {
    super($scope, $injector);
    this.scope = $scope;
    this.uiSegmentSrv = uiSegmentSrv;
    this.$q = $q;
    this.lastQueryError = null;
    this.panelCtrl.events.on(PanelEvents.dataReceived, this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on(PanelEvents.dataError, this.onDataError.bind(this), $scope);
    this.panelCtrl.events.on(PanelEvents.refresh, this.updateRestSqlWithoutRefresh.bind(this), $scope);
    this.updateProjection();
    this.tables = [];
    this.target.target = this.target.target || '';
    this.target.type = this.target.type || 'grafana.timeserie';
    this.target.table = this.target.table || "select table";
    this.target.datasource=this.target.datasource || "RestSQL";
    const from = sqlPart.create({ type: 'from', params: [this.target.table] });
    this.target.fromParts = [from];
    this.target.selectionsParts = this.target.selectionsParts || [];
    this.selectionAdd = this.uiSegmentSrv.newPlusButton();
    this.selectMenu = [];
    this.selectMenu.push(this.uiSegmentSrv.newSegment({ type: 'expression', value: 'Expression' }));
    this.target.whereParts = this.target.whereParts || [];
    this.whereAdd = this.uiSegmentSrv.newPlusButton();
    this.aggAdd = this.uiSegmentSrv.newPlusButton();
    this.target.groupParts = this.target.groupParts || [];
    this.groupAdd = this.uiSegmentSrv.newPlusButton();
    //修复SELECT COLUMN出现五个空格bug
    if(typeof this.target.timeField !== "Array"){
      this.target.timeField = [];
    }
    this.target.timeField = this.target.timeField || [];
    console.log("timeFields(len):"+this.target.timeField.length)
    this.timeFieldAdd = this.uiSegmentSrv.newPlusButton();
    this.target.sortParts = this.target.sortParts || [];
    this.sortAdd = this.uiSegmentSrv.newPlusButton();
    this.target.fieldParts = this.target.fieldParts || [];
    this.fieldAdd = this.uiSegmentSrv.newPlusButton();

    // 初始化timeShift部分
    this.dimensions = [
      { text: 'second', value: 's' },
      { text: 'minute', value: 'm' },
      { text: 'hour', value: 'h' },
      { text: 'day', value: 'd' },
      { text: 'week', value: 'w' },
      { text: 'month', value: 'M' },
      { text: 'year', value: 'y' }
    ];
    this.target.timeAggSegment = this.uiSegmentSrv.newSegment({ "value": this.target.timeAgg || '0', "fake": true });
    this.target.timeAgg = this.target.timeAggSegment.value || '0';
    this.target.timeAggDimension = this.target.timeAggDimension || 'd';

    this.target.timeShiftSegment = this.uiSegmentSrv.newSegment({ "value": this.target.timeShift || '0', "fake": true });
    this.target.timeShift = this.target.timeShiftSegment.value || '0';
    this.target.timeShiftDimension = this.target.timeShiftDimension || 'd'; //默认为天

    // 初始化limit部分
    this.target.queryLimitSegment = this.uiSegmentSrv.newSegment({ "value": this.target.queryLimit || '1000', "fake": true });
    this.target.queryLimit = this.target.queryLimitSegment.value || '1000'; //实际输入的值在这里
    this.target.query= this.target.query || {
      "from":"",
      "time":{},
      "select":[],
      "where":[],
      "group":[],
      "limit": 1000
    }
    this.variables = this.variables || {}
    this.timeFrom = this.panelCtrl.datasource.templateSrv.timeRange.from.format();
    this.timeTo = this.panelCtrl.datasource.templateSrv.timeRange.to.format();
    this.getTables(); // load available tables
  }


  // -----------------------------------------------------------------


  // 数据回填
  updateProjection() { // todo: 数据回填dimentions
    console.log("DEBUG: Query: updateProjection: ", this.target);
    if (this.target.target) {
      for (const key in this.target) { //拆解出每一部分
        if (key.includes('Parts') && this.target[key].length > 0) {
          this.target[key].forEach((ele, index) => {//一个是json体，一个是下标 下面使用part端进行生成
            this.target[key].splice(index, 1, sqlPart.create(ele.part))
          })
        } else if (key.includes('Segment')) { //放入value值
          this.target[key] = this.uiSegmentSrv.newSegment({ "value": this.target[key].value, "fake": true })
        } else {
          this.target.type = this.target.type;
        }
      }
    }
  }

  transformToSegments() {
    return (result) => {
      const segments = _.map(results, segment => {
        return this.uiSegmentSrv.newSegment({
          value: segment.text,
          expandable: segment.expandable,
        });
      });
      return segments;
    }
  }

  // Known issus 1
  onDataReceived(dataList) {
    console.log("DEBUG: Data Received:", dataList);
    this.lastQueryError = null
  }
  onDataError(err) {
    if (this.target.target) {
      this.lastQueryError = err.message
    }

  }

  getOptions() {
    const options = [];
    options.push(this.uiSegmentSrv.newSegment({ type: 'expression', value: 'Expression' }));
    return Promise.resolve(options);
  }

  removePart(parts, part) {
    const index = _.indexOf(parts, part);
    parts.splice(index, 1);
  }

  // onFormatChanged() {
  //   // Todo: 暂时取消隐藏无关字段功能。由于无法找到页面完全载入的回调，table形式重载入时会显现。
  //   // if (this.target.type === 'grafana.timeserie')
  //   //   document.getElementById("timeSeriesSpecial").style.display = "flex";
  //   // else if (this.target.type === 'grafana.table')
  //   //   document.getElementById("timeSeriesSpecial").style.display = "none";
  //   this.updateRestSql();
  // }

  onTableChanged(table) {
    console.log("tableChanged", table);
    this.target.table = table;
    this.updateRestSql();
  }

  getTables() { // get available tables from the db
    this.datasource.metricFindTables().then(result => {
      console.log("DEBUG: Available tables are: ", result.data);
      this.tables = result.data;
    })
  }
  
  onTimeAggChanged() {
    this.target.timeAgg = this.target.timeAggSegment.value;
    this.updateRestSql();
  }

  onBeginChanged() {
    this.target.begin= this.target.beginSegment.value;
    this.updateRestSql();
  }

  onEndChanged() {
    this.target.end = this.target.endSegment.value;
    this.updateRestSql();
  }

  onTimeShiftChanged() {
    this.target.timeShift = this.target.timeShiftSegment.value;
    this.updateRestSql();
  }

  onTimeAggDimensionChanged() {
    this.updateRestSql();
  }

  onTimeShiftDimensionChanged() {
    this.updateRestSql();
  }
  
  onLimitQueryChanged() {
    this.target.queryLimit = this.target.queryLimitSegment.value;
    this.updateRestSql()
  }
  
  handleFromPartEvent(part, index, event) {
    if (event.name === "part-param-changed") {
      this.onTableChanged(part.params[0]);
    } else if (event.name === "get-param-options") {
      return Promise.resolve(this.uiSegmentSrv.newOperators(this.tables));
    }
  }
  
  addSelectionAction(part, index) {
    this.getOptions()
    const express = sqlPart.create({ type: 'select', params: ['column','alias','aggregate'] });
    this.target.selectionsParts.push(express);
    this.resetPlusButton(this.selectionAdd);
  }

  handleSelectionsPartEvent(part, index, event) {
    console.log("解决handleselectpartenvent");
    console.log(event);
    console.log(this.uiSegmentSrv);
    if (event.name === "get-part-actions") {
      return this.$q.when([{ text: 'Remove', value: 'remove' }]);
    } else if (event.name === "action" && event.action.value === "remove") {
      this.removePart(this.target.selectionsParts, part);
      this.updateRestSql();
    } else if (event.name === "part-param-changed") {
      this.updateRestSql();
      return Promise.resolve([this.target.table]);
      
    } else{
         console.log("8-8hhhhhhhh");
            return Promise.resolve([this.target.table]);
    }
    // else if (event.name === "get-param-options"&& event.param.name === "column") {
    //   console.log("8-8hhhhhhhh");
    //   return Promise.resolve([this.target.table]);

    //   // this.updateRestSql();
    // } else if (event.name === "get-param-options" && event.param.name === "alias") {
    //   return Promise.resolve(this.uiSegmentSrv.newOperators());}
  }

  addWhereAction(part, index) {
    const express = sqlPart.create({ type: 'expression', params: ['column', '=', 'value'] });
    this.target.whereParts.push(express);
    this.resetPlusButton(this.whereAdd);
  }

  handleWherePartEvent(part, index, event) {
    if (event.name === "get-param-options" && event.param.name === "op") {
      const operators = ['=', '<', '<=', '>', '>=', 'CONTAINS', 'STARTSWITH', 'ENDSWITH', 'RANGE', 'IN'];
      return Promise.resolve(this.uiSegmentSrv.newOperators(operators));
    } else if (event.name === "get-param-options" && event.param.name === "left") {
      // 左值为可选列
      return Promise.resolve([this.target.table]);
    } else if (event.name === "get-part-actions") {
      return this.$q.when([{ text: 'Remove', value: 'remove' }]);
    } else if (event.name === "action" && event.action.value === "remove") {
      this.target.whereParts.splice(index, 1);
      this.updateRestSql()
    } else if (event.name === "part-param-changed") {
      console.log(part, index, '😎');
      this.updateRestSql();
    } else {
      return Promise.resolve([]);
    }
  }

  addGroupAction() {
    const express = sqlPart.create({ type: 'column', params: ['column'] });
    console.log("addGroupsAction", express);
    this.target.groupParts.push(express);
    this.resetPlusButton(this.groupAdd);
  }

  addTimeFieldAction() {
    const express = sqlPart.create({ type: 'column', params: ['column'] });
    console.log("addTimeFieldAction", express);
    this.target.timeField.push(express);
    this.resetPlusButton(this.timeFieldAdd);
  }

  handleGroupPartEvent(part, index, event) {
    // console.log("handleGroupsPartEvent");
    if (event.name === "get-part-actions") {
      return this.$q.when([{ text: 'Remove', value: 'remove' }]);
    } else if (event.name === "get-param-options") {
      // return Promise.resolve(this.uiSegmentSrv.newOperators(this.target.columnOptions[this.target.table]));
      
      this.updateRestSql();
      return Promise.resolve([this.target.table]);
    } else if (event.name === "action" && event.action.value === "remove") {
      this.target.groupParts.splice(index, 1);
      this.updateRestSql()
    } else if (event.name === "part-param-changed") {
      this.updateRestSql();
      return Promise.resolve([this.target.table]);
      
    }
  }

  handleTimeFieldEvent(part, index, event) {
    // console.log("handleTimeFieldEvent");
    if (event.name === "get-part-actions") {
      return this.$q.when([{ text: 'Remove', value: 'remove' }]);
    } else if (event.name === "get-param-options") {
      // return Promise.resolve(this.uiSegmentSrv.newOperators(this.target.columnOptions[this.target.table]));
      this.updateRestSql();
      return Promise.resolve([this.target.table]);
    } else if (event.name === "action" && event.action.value === "remove") {
      this.target.timeField.splice(index, 1);
      this.updateRestSql()
    } else if (event.name === "part-param-changed") {
      this.updateRestSql();
      return Promise.resolve([this.target.table]);
    }
  }

  handleSortPartEvent(part, index, event) {
    console.log("handleSortPartEvent", event);
    if (event.name === "get-part-actions") {
      return this.$q.when([{ text: 'Remove', value: 'remove' }]);
    } else if (event.name === "action" && event.action.value === "remove") {
      this.target.sortParts.splice(index, 1);
      this.updateRestSql();
    } else if (event.name === "get-param-options" && event.param.name === "field") {
      return Promise.resolve(this.uiSegmentSrv.newOperators(this.getAllFields()));
    } else if (event.name === "part-param-changed") {
      this.updateRestSql();
    } else {
      return Promise.resolve([]);
    }
  }

  resetPlusButton(button) {
    const plusButton = this.uiSegmentSrv.newPlusButton();
    button.html = plusButton.html;
    button.value = plusButton.value;
  }

  updateRestSql() {
    this.updateRestSqlWithoutRefresh();
    if (this.target.query.select !== null &&
      this.target.query.select !== undefined &&
      this.target.query.select !== "") { // only refresh when fields in filled.
      this.panelCtrl.refresh();
    }
  }

  isJson(inputStr) {
    try {
      if (typeof JSON.parse(inputStr) == "object") {
        return true;
      }
    } catch (e) {
    }
    return false;
  }

  handleWhereParts(parts) {
    let whereTarget = [];
    const operatorToSuffix = {
      "=": "=",
      "<": "<",
      "<=": "<=",
      ">": ">",
      ">=": ">=",
      "startswith": "startswith",
      "endswith": "endswith",
      "RANGE": "__range",
      "IN": "__in"
    }
    console.log(parts);
    parts.forEach((part) => {
      let temp={};
      temp.column=part.params[0];
      temp.op=operatorToSuffix[part.params[1]];
      temp.value=part.params[2];
      whereTarget.push(temp);
    });
    console.log("where")
    console.log(whereTarget)
    return whereTarget;
  }

  updateRestSqlWithoutRefresh() {
    // 将输入的内容更新到target中去
    // restSql协议结构定义
    this.target.query={
      "from":"",
      "time":{},
      "select":[],
      "where":[],
      "group":[],
      "limit": 1000
    }
    // udpate table
    this.target.query.from = `${this.target.datasource}.${this.target.table}`;
    console.log("the datasource.table"+this.target.query.from)
    // update queryLimit
    this.target.query.limit = parseInt(this.target.queryLimit);

    // update select fields
    this.target.selectionsParts.forEach((part) => {
      console.log(part)
      const item ={"column":part.params[0],"alias":part.params[1],"metric":part.params[2]}
      this.target.query.select.push(item);
    });
    // update time range
    this.timeFrom = this.panelCtrl.datasource.templateSrv.timeRange.from.format();
    this.timeTo = this.panelCtrl.datasource.templateSrv.timeRange.to.format();
    console.log("updaterestsql", this.timeFrom, this.timeTo);
    this.target.query.time.begin=this.timeFrom
    this.target.query.time.end=this.timeTo
    this.target.query.time.interval=this.target.timeAgg+this.target.timeAggDimension;
    //where条件处理
    const result=this.handleWhereParts(this.target.whereParts);
    result.forEach((item)=>{
      this.target.query.where.push(item)
    })
    // update group by
    this.target.groupParts.forEach((part) => {
      console.log("groupParts", part);
      this.target.query.group.push(part.params[0]);
    });

    // update column
    this.target.timeField.forEach((part) => {
      this.target.query.time.column = part.params[0];
    });
    
    // update sort
    // this.target.sortParts.forEach((part) => {
    //   const sortExp = part.params[0] === "asc" ? part.params[1] : `-${part.params[1]}`;
    //   this.target.query.sort.push(sortExp);
    // });

    this.target.target = JSON.stringify(this.target.query);
  }

}
RestSqlDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';

