# datasource

## 必须实现

1. query(option): panel查询数据
2. testDatasource(): 数据源页面验证数据源可用
4. metricFindQuery(options): 查询编辑页面获取提示信息

## 请求url

1. `/` - `testDatasource()`: datasource判断可用与否

   简单判断code=200即可。

2. `/query` - ` query(options)`: 查询主体

   ```json
   {
       "url": "/query",
       "method": "POST",
       "data": {
           "query": ,
           "format": 
       }
   }
   ```

3. `/search` - `metricFindQuery(query)`: 变量variable

4. `/find_options/` - `metricFindOption`: 指定表的可用字段

5. `/find_tables` - `metricFindTables`: 指定数据库的可用表

## 修改日志

### 2020.10.15

添加注释，修改日志显示

### 2020.10.19

尝试添加多query前端支持。

