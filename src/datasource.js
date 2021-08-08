import _ from "lodash";
import { resultsToDataFrames } from "@grafana/data";

export class RestSqlDatasource {

  /*
    query(option): panel查询数据
    testDatasource(): 数据源页面验证数据源可用
    annotationQuery(options): dashboard获取注释信息
    metricFindQuery(options): 查询编辑页面获取提示信息
  */

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    console.log("------ DataSource ------");
    console.log("instanceSettings: ", instanceSettings);
    console.log("backendSrv: ", backendSrv);
    console.log("templateSrv: ", templateSrv);
    console.log("------ DataSource ------");
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    console.log("url:"+this.url);
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.withCredentials = instanceSettings.withCredentials;
    this.headers = { 'Content-Type': 'application/json' };
    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
      this.headers['Authorization'] = instanceSettings.basicAuth;
    }
  }

  isJson(inputStr) {
    try {
      if (typeof JSON.parse(inputStr) === "object") {
        return true;
      }
    } catch (e) {
    }
    return false;
  }

  getAllVariables(varName) {
    console.log("getAllVariables: varName:", varName);
    const varList = [];
    this.templateSrv.variables.forEach((variable) => {
      if (variable.name === varName.substring(1)) {
        variable.options.forEach((option) => {
          if (option.value !== "$__all") {
            varList.push(option.value);
          }
        });

      }
    });
    return JSON.stringify(varList);
  }

  getQueryStr(target, timeshift) {
    console.log("DEBUG: Query Variable: target:  ", target);
    const queryJson = JSON.parse(target.target);
    const filters = queryJson['select']['filter'];
    // timeFrom、timeTo就是query panel右上方的时间控制变量
    const timeFromOrig = new Date(this.templateSrv.timeRange.from + timeshift); // timestamp
    const timeFrom = `${timeFromOrig.getFullYear().toString().padStart(4,'0')}-${(timeFromOrig.getMonth() + 1).toString().padStart(2,'0')}-${timeFromOrig.getDate().toString().padStart(2,'0')} ${timeFromOrig.getHours().toString().padStart(2,'0')}:${timeFromOrig.getMinutes().toString().padStart(2,'0')}:${timeFromOrig.getSeconds().toString().padStart(2,'0')}`;
    const timeToOrig = new Date(this.templateSrv.timeRange.to + timeshift);
    const timeTo = `${timeToOrig.getFullYear().toString().padStart(4,'0')}-${(timeToOrig.getMonth() + 1).toString().padStart(2,'0')}-${timeToOrig.getDate().toString().padStart(2,'0')} ${timeToOrig.getHours().toString().padStart(2,'0')}:${timeToOrig.getMinutes().toString().padStart(2,'0')}:${timeToOrig.getSeconds().toString().padStart(2,'0')}`;
    // variables就是左上方的用户自定义变量
    const variables = {};
    this.templateSrv.variables.forEach(ele => {
      const key = "$" + ele.name;
      variables[key] = ele.current.value;
    });
    console.log("DEBUG: Query Variable: time: ", timeFrom, timeTo);
    // 主查询语句variables替换
    Object.keys(filters).map((key) => {
      if (typeof filters[key] !== "number") { // todo: warning: 每次只能匹配到一个值，但是后面又用循环处理
        const varList = filters[key].match(/\$(__)*[a-zA-Z]+/g);
        console.log("DEBUG: datasource: queryStr: ", varList);
        if (varList) {
          varList.forEach((varItem) => {
            if (Object.keys(variables).includes(varItem)) {
              let varValue = variables[varItem];
              if (Array.isArray(varValue) && varValue.length > 1) {
                // 变量多选时，变量值为Array
                filters[key] = JSON.stringify(varValue);
              } else {
                filters[key] = filters[key].replace(varItem, varValue);
                if (filters[key] === "$__all") {
                  // 变量选择”All“
                  console.log("change all value");
                  filters[key] = this.getAllVariables(varItem);
                }
              }
            } else if (["$__timeFrom"].includes(varItem)) {
              filters[key] = filters[key].replace(varItem, `'${timeFrom}'`);
            } else if (["$__timeTo"].includes(varItem)) {
              filters[key] = filters[key].replace(varItem, `'${timeTo}'`);
            }
          });
        }
        if (this.isJson(filters[key])) {
          filters[key] = JSON.parse(filters[key]);
        } else if (filters[key].startsWith("\"") && filters[key].endsWith("\"")) {
          // 删除前后多余的引号
          filters[key] = filters[key].substring(1, filters[key].length - 1);
        }
      }
    });
    console.log("queryJson:"+queryJson)
    return queryJson;
  }

  query(options) {
    console.log("grafana debug: Original Options: ", options);
    if (options.targets.length <= 0) {
      return this.q.when({ data: [] });
    }
    const resultlist=[];//返回结果都填充进这里
    options.targets.forEach(target => {
          if(target.query == null || target.query ==undefined) {
            return this.q.when({data:[]})
          }
          console.log("query");
          //添加时间间隔
          const singleQuery=target.query;
          if (typeof singleQuery ==="object"){
            const timeFromOrig = new Date(options.range.from.valueOf())
            console.log("timeFromOrig:"+timeFromOrig)
            const timeFrom = `${timeFromOrig.getFullYear().toString().padStart(4,'0')}-${(timeFromOrig.getMonth() + 1).toString().padStart(2,'0')}-${timeFromOrig.getDate().toString().padStart(2,'0')} ${timeFromOrig.getHours().toString().padStart(2,'0')}:${timeFromOrig.getMinutes().toString().padStart(2,'0')}:${timeFromOrig.getSeconds().toString().padStart(2,'0')}`;
            const timeToOrig = new Date(options.range.to.valueOf())
            const timeTo = `${timeToOrig.getFullYear().toString().padStart(4,'0')}-${(timeToOrig.getMonth() + 1).toString().padStart(2,'0')}-${timeToOrig.getDate().toString().padStart(2,'0')} ${timeToOrig.getHours().toString().padStart(2,'0')}:${timeToOrig.getMinutes().toString().padStart(2,'0')}:${timeToOrig.getSeconds().toString().padStart(2,'0')}`;
            console.log("timeFrom:"+timeFrom)
            singleQuery.time.begin=timeFrom;
            singleQuery.time.end=timeTo;
          }
          console.log("singleQuery:"+singleQuery);
          resultlist.push(singleQuery);
        }
    );
    return this.doRequest({
      url: this.url + '/query',
      method: 'POST',
      data: resultlist
    }).then(function(resp){
      if (resp.data.status === "error") {
        return Promise.reject(new Error(resp.data.msg));
      } else if (resp.data.status === "ok") {
        console.log("DEBUG: Query: Received: ", resp.data);
        return resp.data;
      }
      return [];
    });
  }

  testDatasource() {
    return this.doRequest({
      url: this.url + '/',
      method: 'GET',
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Restsql server is ready!", title: "Success" };
      }
    });
  }
  
  metricFindQuery(query) {
    /*
        
    */
    //console.log("metricFindQuery", query);
    const payload = {
      "target": this.templateSrv.replace(query, null, 'regex')
    };

    console.log("metricFindQuery", payload);
    return this.doRequest({
      url: this.url + '/search',
      data: payload,
      method: 'POST',
    }).then((resp) => {
      if (resp && resp.data && resp.data.status === "error") {
        return Promise.reject(new Error(resp.data.msg));
      } else if (resp && resp.data && resp.data.status === "ok") {
        return this.mapToTextValue(resp.data);
      } else {
        return [];
      }
    });
  }


  // 下拉选项
  metricFindOption(tableName) {
    const payload = {
      tableName
    }
    return this.doRequest({
      url: this.url + '/find_options',
      method: 'POST',
      data: payload
    }).then((resp) => {
      if (resp.data.status === "error") {
        return Promise.reject(new Error(resp.data.msg));
      } else if (resp.data.status === "ok") {
        return resp.data;
      }
    });
    ;
  }

  metricFindTables() {
    return this.doRequest({
      url: this.url + '/find_tables',
      method: 'GET',
    }).then((resp) => {
      if (resp.data.status === "error") {
        return Promise.reject(new Error(resp.data.msg));
      } else if (resp.data.status === "ok") {
        return resp.data;
      }
    });
  }
  
  mapToTextValue(result) {
    /*
        用于metricFindQuery调整下拉选框
    */
    console.log('metricFindQuery received: ', result);
    return _.map(result.data, (d, i) => {
      if (d && d.text && d.value) {
        return { text: d.text, value: d.value };
      } else if (_.isObject(d)) {
        return { text: d, value: i };
      }
      return { text: d, value: d };
    });
  }

  doRequest(options) {
    options.withCredentials = this.withCredentials;
    options.headers = this.headers;
    console.log("debug 1");
    console.log(this.backendSrv.datasourceRequest(options))
    return this.backendSrv.datasourceRequest(options).then((response)=>{
      return response
    }) //此处额外在then中进行返回，防止上层函数调用doRequest使用then出现undefined问题
    // return this.backendSrv.datasourceRequest(options);
  }

  //todo 可能不需要用到
  // filter targets.target
  buildQueryParameters(options) {
    options.targets = _.filter(options.targets, target => {
      return target.target !== 'select metric';
    });

    var targets = _.map(options.targets, target => {
      const queryRow = this.templateSrv.replace(target.target, options.scopedVars, 'regex');
      var query = JSON.parse(queryRow);
      if (query.select.aggregation.length > 0) {
        this.filterAggregation(query.select.aggregation)
      }
      query.join.forEach(element => {
        if (element.query.select.aggregation.length > 0) {
          this.filterAggregation(element.query.select.aggregation)
        }
      });
      return {
        target: JSON.stringify(query),
        // target: query,
        refId: target.refId,
        hide: target.hide,
        type: target.type || 'timeserie'
      };
    });

    options.targets = targets;

    return options;
  }


  //  filter query aggregation
  filterAggregation(array) {
    const varables = []
    this.templateSrv.variables.forEach(ele => {
      varables.push({
        name: '$' + ele.name,
        value: ele.current.value
      })
    });
    varables.forEach(element => {
      if (array.length > 0) {
        array.forEach((ele, index) => {
          console.log(ele, element, '222');
          if (ele.startsWith(element.name)) {
            var field = ele.split('__')
            field[0] = "(" + element.value.join(',') + ")"
            array.splice(index, 1, [field[0], field[1]].join('__'))
          }
        })
      }

    })
  }

}
