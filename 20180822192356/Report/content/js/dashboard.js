/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
    var dataset = [
        {
            "label" : "KO",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "OK",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [1.0, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "确认完成股东情况"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成实际控制人及持股比例"], "isController": false}, {"data": [1.0, 500, 1500, "上传外部资金方情况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传理财部门整体介绍非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "录入实际控制人及持股比例"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成对外负债情况"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司组织架构标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传产品类别及对应流程图、简介非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传主要部门负责人及简介标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传股权结构非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传股东情况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成非标准附件(业务信息)"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成外部资金方情况"], "isController": false}, {"data": [1.0, 500, 1500, "状态显示"], "isController": false}, {"data": [1.0, 500, 1500, "上传人法、仲裁、失信情况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传关联公司标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传产品大纲、盈利逻辑分析及具体收费标准非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司简介非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传业务模式、市场定位分析、主营业务竞争优势非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成业务总量概况"], "isController": false}, {"data": [1.0, 500, 1500, "上传业务地域分布情况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成近一年有息负债融资清单及相应的协议"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成关联公司"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成公司各月募资情况线下"], "isController": false}, {"data": [1.0, 500, 1500, "上传关联方股权结构图非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成公司各月募资情况线上"], "isController": false}, {"data": [1.0, 500, 1500, "上传渠道、业务人员返点制度非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成外部融资渠道最近一年的融资台账"], "isController": false}, {"data": [1.0, 500, 1500, "上传Top5资金方协议非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成理财部门整体介绍"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成尽调情况"], "isController": false}, {"data": [1.0, 500, 1500, "登录"], "isController": false}, {"data": [1.0, 500, 1500, "上传营业执照非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成商务部初审意见"], "isController": false}, {"data": [1.0, 500, 1500, "录入尽调信息"], "isController": false}, {"data": [1.0, 500, 1500, "查询资产方ZC0576"], "isController": false}, {"data": [1.0, 500, 1500, "上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传业务总量概况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成企业基本情况"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成对外担保情况"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成业务门店分布情况"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成非标准附件(风控部门资料)"], "isController": false}, {"data": [1.0, 500, 1500, "上传验资报告非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传近一年有息负债融资清单及相应的协议标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司募资余额产品结构情况标准附件线上"], "isController": false}, {"data": [1.0, 500, 1500, "录入企业工商信息"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司募资余额产品结构情况标准附件线下"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司各月募资情况标准附件线下"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司各月募资情况标准附件线上"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成人法、仲裁、失信情况"], "isController": false}, {"data": [1.0, 500, 1500, "上传外部融资渠道最近一年的融资台账标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成主要部门负责人及简介"], "isController": false}, {"data": [1.0, 500, 1500, "上传客户进件资料与合同非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传业务门店分布情况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传近一年每月代偿台账非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传客户、经销商、门店准入及筛选标准非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成公司组织架构"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成企业工商信息"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成非标准附件(财务信息)"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成公司募资余额产品结构情况线下"], "isController": false}, {"data": [1.0, 500, 1500, "录入企业基本情况"], "isController": false}, {"data": [1.0, 500, 1500, "上传对外负债情况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成融资情况"], "isController": false}, {"data": [1.0, 500, 1500, "录入商务部初审意见"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司未来发展计划非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "创建资产方"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成公司募资余额产品结构情况线上"], "isController": false}, {"data": [1.0, 500, 1500, "确认完成业务地域分布情况"], "isController": false}, {"data": [1.0, 500, 1500, "提交审批"], "isController": false}, {"data": [1.0, 500, 1500, "上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传对外担保情况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传近三年审计报告、咨询报告非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司股东、高级管理人员简历非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传融资情况标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "提交风控"], "isController": false}, {"data": [1.0, 500, 1500, "上传公司章程非标准附件"], "isController": false}, {"data": [1.0, 500, 1500, "上传两年一期末级科目余额表非标准附件"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 80, 0, 0.0, 247.13750000000016, 187, 478, 286.0, 364.8000000000002, 478.0, 3.6386791594651138, 2.600642880696807, 3.4896585469162194], "isController": false}, "titles": ["Label", "#Samples", "KO", "Error %", "Average", "Min", "Max", "90th pct", "95th pct", "99th pct", "Throughput", "Received", "Sent"], "items": [{"data": ["确认完成股东情况", 1, 0, 0.0, 199.0, 199, 199, 199.0, 199.0, 199.0, 5.025125628140704, 3.508754711055276, 3.8326397613065324], "isController": false}, {"data": ["确认完成实际控制人及持股比例", 1, 0, 0.0, 207.0, 207, 207, 207.0, 207.0, 207.0, 4.830917874396135, 3.3731506642512077, 3.698671497584541], "isController": false}, {"data": ["上传外部资金方情况标准附件", 1, 0, 0.0, 262.0, 262, 262, 262.0, 262.0, 262.0, 3.8167938931297707, 2.650137166030534, 6.470658396946565], "isController": false}, {"data": ["上传理财部门整体介绍非标准附件", 1, 0, 0.0, 269.0, 269, 269, 269.0, 269.0, 269.0, 3.717472118959108, 2.5739138011152414, 3.6194528345724906], "isController": false}, {"data": ["录入实际控制人及持股比例", 1, 0, 0.0, 252.0, 252, 252, 252.0, 252.0, 252.0, 3.968253968253968, 2.7553013392857144, 3.2939608134920633], "isController": false}, {"data": ["确认完成对外负债情况", 1, 0, 0.0, 193.0, 193, 193, 193.0, 193.0, 193.0, 5.181347150259067, 3.587475712435233, 3.9720288212435233], "isController": false}, {"data": ["上传公司组织架构标准附件", 1, 0, 0.0, 254.0, 254, 254, 254.0, 254.0, 254.0, 3.937007874015748, 2.74898499015748, 4.675196850393701], "isController": false}, {"data": ["上传产品类别及对应流程图、简介非标准附件", 1, 0, 0.0, 240.0, 240, 240, 240.0, 240.0, 240.0, 4.166666666666667, 2.8767903645833335, 4.093424479166667], "isController": false}, {"data": ["上传主要部门负责人及简介标准附件", 1, 0, 0.0, 253.0, 253, 253, 253.0, 253.0, 253.0, 3.952569169960474, 2.7444108201581026, 4.0953866106719365], "isController": false}, {"data": ["上传股权结构非标准附件", 1, 0, 0.0, 251.0, 251, 251, 251.0, 251.0, 251.0, 3.9840637450199203, 2.7740600099601593, 3.692262201195219], "isController": false}, {"data": ["上传股东情况标准附件", 1, 0, 0.0, 266.0, 266, 266, 266.0, 266.0, 266.0, 3.7593984962406015, 2.6029429041353382, 4.589109492481203], "isController": false}, {"data": ["确认完成非标准附件(业务信息)", 1, 0, 0.0, 218.0, 218, 218, 218.0, 218.0, 218.0, 4.587155963302752, 3.185027236238532, 3.494122706422018], "isController": false}, {"data": ["确认完成外部资金方情况", 1, 0, 0.0, 187.0, 187, 187, 187.0, 187.0, 187.0, 5.347593582887701, 3.702581885026738, 4.146473930481283], "isController": false}, {"data": ["状态显示", 1, 0, 0.0, 291.0, 291, 291, 291.0, 291.0, 291.0, 3.4364261168384878, 7.241999570446736, 2.067225085910653], "isController": false}, {"data": ["上传人法、仲裁、失信情况标准附件", 1, 0, 0.0, 273.0, 273, 273, 273.0, 273.0, 273.0, 3.663003663003663, 2.529046474358974, 3.677312271062271], "isController": false}, {"data": ["上传关联公司标准附件", 1, 0, 0.0, 270.0, 270, 270, 270.0, 270.0, 270.0, 3.7037037037037037, 2.5643807870370368, 3.5228587962962963], "isController": false}, {"data": ["上传产品大纲、盈利逻辑分析及具体收费标准非标准附件", 1, 0, 0.0, 240.0, 240, 240, 240.0, 240.0, 240.0, 4.166666666666667, 2.884928385416667, 4.18701171875], "isController": false}, {"data": ["上传公司简介非标准附件", 1, 0, 0.0, 249.0, 249, 249, 249.0, 249.0, 249.0, 4.016064257028112, 2.7884977409638556, 3.7062311746987953], "isController": false}, {"data": ["上传业务模式、市场定位分析、主营业务竞争优势非标准附件", 1, 0, 0.0, 248.0, 248, 248, 248.0, 248.0, 248.0, 4.032258064516129, 2.791866179435484, 4.103137600806452], "isController": false}, {"data": ["上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件", 1, 0, 0.0, 247.0, 247, 247, 247.0, 247.0, 247.0, 4.048582995951417, 2.7952618927125505, 4.202777074898785], "isController": false}, {"data": ["确认完成业务总量概况", 1, 0, 0.0, 188.0, 188, 188, 188.0, 188.0, 188.0, 5.319148936170213, 3.682887300531915, 4.062084441489362], "isController": false}, {"data": ["上传业务地域分布情况标准附件", 1, 0, 0.0, 278.0, 278, 278, 278.0, 278.0, 278.0, 3.5971223021582737, 2.49058565647482, 5.033863534172662], "isController": false}, {"data": ["确认完成近一年有息负债融资清单及相应的协议", 1, 0, 0.0, 195.0, 195, 195, 195.0, 195.0, 195.0, 5.128205128205129, 3.540665064102564, 3.9713541666666665], "isController": false}, {"data": ["确认完成关联公司", 1, 0, 0.0, 201.0, 201, 201, 201.0, 201.0, 201.0, 4.975124378109452, 3.434973569651741, 3.794504042288557], "isController": false}, {"data": ["确认完成公司各月募资情况线下", 1, 0, 0.0, 216.0, 216, 216, 216.0, 216.0, 216.0, 4.62962962962963, 3.2145182291666665, 3.657588252314815], "isController": false}, {"data": ["上传关联方股权结构图非标准附件", 1, 0, 0.0, 254.0, 254, 254, 254.0, 254.0, 254.0, 3.937007874015748, 2.7182271161417324, 3.7793737696850394], "isController": false}, {"data": ["确认完成公司各月募资情况线上", 1, 0, 0.0, 198.0, 198, 198, 198.0, 198.0, 198.0, 5.050505050505051, 3.4968828914141414, 3.999960542929293], "isController": false}, {"data": ["上传渠道、业务人员返点制度非标准附件", 1, 0, 0.0, 239.0, 239, 239, 239.0, 239.0, 239.0, 4.184100418410042, 2.8969992154811717, 4.028831066945607], "isController": false}, {"data": ["确认完成外部融资渠道最近一年的融资台账", 1, 0, 0.0, 188.0, 188, 188, 188.0, 188.0, 188.0, 5.319148936170213, 3.6724983377659575, 4.134807180851064], "isController": false}, {"data": ["上传Top5资金方协议非标准附件", 1, 0, 0.0, 257.0, 257, 257, 257.0, 257.0, 257.0, 3.8910505836575875, 2.694096546692607, 3.6934581712062258], "isController": false}, {"data": ["确认完成理财部门整体介绍", 1, 0, 0.0, 195.0, 195, 195, 195.0, 195.0, 195.0, 5.128205128205129, 3.540665064102564, 3.9112580128205128], "isController": false}, {"data": ["确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单", 1, 0, 0.0, 193.0, 193, 193, 193.0, 193.0, 193.0, 5.181347150259067, 3.6178351683937824, 3.9315495466321244], "isController": false}, {"data": ["确认完成尽调情况", 1, 0, 0.0, 209.0, 209, 209, 209.0, 209.0, 209.0, 4.784688995215311, 3.303491327751196, 3.635242224880383], "isController": false}, {"data": ["登录", 1, 0, 0.0, 437.0, 437, 437, 437.0, 437.0, 437.0, 2.288329519450801, 1.6335633581235698, 0.8223684210526315], "isController": false}, {"data": ["上传营业执照非标准附件", 1, 0, 0.0, 249.0, 249, 249, 249.0, 249.0, 249.0, 4.016064257028112, 2.7963416164658637, 3.7219189257028114], "isController": false}, {"data": ["确认完成商务部初审意见", 1, 0, 0.0, 188.0, 188, 188, 188.0, 188.0, 188.0, 5.319148936170213, 3.682887300531915, 4.041306515957447], "isController": false}, {"data": ["录入尽调信息", 1, 0, 0.0, 286.0, 286, 286, 286.0, 286.0, 286.0, 3.4965034965034967, 2.4140898164335667, 3.209680944055944], "isController": false}, {"data": ["查询资产方ZC0576", 1, 0, 0.0, 252.0, 252, 252, 252.0, 252.0, 252.0, 3.968253968253968, 3.941127232142857, 2.3561507936507935], "isController": false}, {"data": ["上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件", 1, 0, 0.0, 248.0, 248, 248, 248.0, 248.0, 248.0, 4.032258064516129, 2.783990675403226, 4.23308341733871], "isController": false}, {"data": ["上传业务总量概况标准附件", 1, 0, 0.0, 286.0, 286, 286, 286.0, 286.0, 286.0, 3.4965034965034967, 2.4140898164335667, 5.094514860139861], "isController": false}, {"data": ["确认完成企业基本情况", 1, 0, 0.0, 188.0, 188, 188, 188.0, 188.0, 188.0, 5.319148936170213, 3.682887300531915, 4.020528590425532], "isController": false}, {"data": ["确认完成对外担保情况", 1, 0, 0.0, 187.0, 187, 187, 187.0, 187.0, 187.0, 5.347593582887701, 3.702581885026738, 4.0733622994652405], "isController": false}, {"data": ["确认完成业务门店分布情况", 1, 0, 0.0, 195.0, 195, 195, 195.0, 195.0, 195.0, 5.128205128205129, 3.5506810897435894, 3.90625], "isController": false}, {"data": ["确认完成非标准附件(风控部门资料)", 1, 0, 0.0, 208.0, 208, 208, 208.0, 208.0, 208.0, 4.807692307692308, 3.319373497596154, 3.6902794471153846], "isController": false}, {"data": ["上传验资报告非标准附件", 1, 0, 0.0, 277.0, 277, 277, 277.0, 277.0, 277.0, 3.6101083032490977, 2.506627933212996, 3.3703745487364616], "isController": false}, {"data": ["上传近一年有息负债融资清单及相应的协议标准附件", 1, 0, 0.0, 286.0, 286, 286, 286.0, 286.0, 286.0, 3.4965034965034967, 2.420918924825175, 4.3842875874125875], "isController": false}, {"data": ["上传公司募资余额产品结构情况标准附件线上", 1, 0, 0.0, 262.0, 262, 262, 262.0, 262.0, 262.0, 3.8167938931297707, 2.6426824904580153, 4.729991650763359], "isController": false}, {"data": ["录入企业工商信息", 1, 0, 0.0, 265.0, 265, 265, 265.0, 265.0, 265.0, 3.7735849056603774, 2.6053950471698113, 4.790683962264151], "isController": false}, {"data": ["上传公司募资余额产品结构情况标准附件线下", 1, 0, 0.0, 270.0, 270, 270, 270.0, 270.0, 270.0, 3.7037037037037037, 2.571614583333333, 4.58984375], "isController": false}, {"data": ["上传公司各月募资情况标准附件线下", 1, 0, 0.0, 258.0, 258, 258, 258.0, 258.0, 258.0, 3.875968992248062, 2.6760840600775193, 6.934350775193798], "isController": false}, {"data": ["上传公司各月募资情况标准附件线上", 1, 0, 0.0, 246.0, 246, 246, 246.0, 246.0, 246.0, 4.065040650406504, 2.8066247459349594, 7.288490853658537], "isController": false}, {"data": ["确认完成人法、仲裁、失信情况", 1, 0, 0.0, 189.0, 189, 189, 189.0, 189.0, 189.0, 5.291005291005291, 3.663401124338624, 4.025090939153439], "isController": false}, {"data": ["上传外部融资渠道最近一年的融资台账标准附件", 1, 0, 0.0, 255.0, 255, 255, 255.0, 255.0, 255.0, 3.9215686274509802, 2.7152267156862746, 4.825367647058823], "isController": false}, {"data": ["确认完成主要部门负责人及简介", 1, 0, 0.0, 194.0, 194, 194, 194.0, 194.0, 194.0, 5.154639175257732, 3.579051224226804, 3.971689755154639], "isController": false}, {"data": ["上传客户进件资料与合同非标准附件", 1, 0, 0.0, 254.0, 254, 254, 254.0, 254.0, 254.0, 3.937007874015748, 2.7182271161417324, 3.7563053641732282], "isController": false}, {"data": ["上传业务门店分布情况标准附件", 1, 0, 0.0, 264.0, 264, 264, 264.0, 264.0, 264.0, 3.787878787878788, 2.6152639678030303, 4.564689867424242], "isController": false}, {"data": ["上传近一年每月代偿台账非标准附件", 1, 0, 0.0, 235.0, 235, 235, 235.0, 235.0, 235.0, 4.25531914893617, 2.962932180851064, 4.06000664893617], "isController": false}, {"data": ["上传客户、经销商、门店准入及筛选标准非标准附件", 1, 0, 0.0, 266.0, 266, 266, 266.0, 266.0, 266.0, 3.7593984962406015, 2.6029429041353382, 3.7447133458646613], "isController": false}, {"data": ["上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件", 1, 0, 0.0, 248.0, 248, 248, 248.0, 248.0, 248.0, 4.032258064516129, 2.791866179435484, 4.997007308467742], "isController": false}, {"data": ["确认完成公司组织架构", 1, 0, 0.0, 193.0, 193, 193, 193.0, 193.0, 193.0, 5.181347150259067, 3.6178351683937824, 4.027687823834197], "isController": false}, {"data": ["确认完成企业工商信息", 1, 0, 0.0, 199.0, 199, 199, 199.0, 199.0, 199.0, 5.025125628140704, 3.469495917085427, 3.813010364321608], "isController": false}, {"data": ["确认完成非标准附件(财务信息)", 1, 0, 0.0, 232.0, 232, 232, 232.0, 232.0, 232.0, 4.310344827586206, 2.9928273168103448, 3.279061153017241], "isController": false}, {"data": ["确认完成公司募资余额产品结构情况线下", 1, 0, 0.0, 191.0, 191, 191, 191.0, 191.0, 191.0, 5.235602094240838, 3.6352666884816753, 4.064749672774869], "isController": false}, {"data": ["录入企业基本情况", 1, 0, 0.0, 292.0, 292, 292, 292.0, 292.0, 292.0, 3.4246575342465753, 2.3778627996575343, 3.789196275684932], "isController": false}, {"data": ["上传对外负债情况标准附件", 1, 0, 0.0, 304.0, 304, 304, 304.0, 304.0, 304.0, 3.289473684210526, 2.2839997944078947, 4.086143092105263], "isController": false}, {"data": ["确认完成融资情况", 1, 0, 0.0, 189.0, 189, 189, 189.0, 189.0, 189.0, 5.291005291005291, 3.6530671296296298, 4.08192791005291], "isController": false}, {"data": ["录入商务部初审意见", 1, 0, 0.0, 250.0, 250, 250, 250.0, 250.0, 250.0, 4.0, 2.76953125, 4.35546875], "isController": false}, {"data": ["上传公司未来发展计划非标准附件", 1, 0, 0.0, 249.0, 249, 249, 249.0, 249.0, 249.0, 4.016064257028112, 2.7728099899598395, 3.870952560240964], "isController": false}, {"data": ["创建资产方", 1, 0, 0.0, 224.0, 224, 224, 224.0, 224.0, 224.0, 4.464285714285714, 3.199986049107143, 3.0125209263392856], "isController": false}, {"data": ["确认完成公司募资余额产品结构情况线上", 1, 0, 0.0, 208.0, 208, 208, 208.0, 208.0, 208.0, 4.807692307692308, 3.319373497596154, 3.770094651442308], "isController": false}, {"data": ["确认完成业务地域分布情况", 1, 0, 0.0, 203.0, 203, 203, 203.0, 203.0, 203.0, 4.926108374384237, 3.401131465517241, 3.7619304187192117], "isController": false}, {"data": ["提交审批", 1, 0, 0.0, 472.0, 472, 472, 472.0, 472.0, 472.0, 2.1186440677966103, 1.471050715042373, 1.3510493908898307], "isController": false}, {"data": ["上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件", 1, 0, 0.0, 248.0, 248, 248, 248.0, 248.0, 248.0, 4.032258064516129, 2.791866179435484, 4.118888608870968], "isController": false}, {"data": ["上传对外担保情况标准附件", 1, 0, 0.0, 277.0, 277, 277, 277.0, 277.0, 277.0, 3.6101083032490977, 2.4925259476534296, 3.9943874097472922], "isController": false}, {"data": ["上传近三年审计报告、咨询报告非标准附件", 1, 0, 0.0, 242.0, 242, 242, 242.0, 242.0, 242.0, 4.132231404958678, 2.853015237603306, 4.0353822314049586], "isController": false}, {"data": ["上传公司股东、高级管理人员简历非标准附件", 1, 0, 0.0, 256.0, 256, 256, 256.0, 256.0, 256.0, 3.90625, 2.712249755859375, 3.856658935546875], "isController": false}, {"data": ["上传融资情况标准附件", 1, 0, 0.0, 264.0, 264, 264, 264.0, 264.0, 264.0, 3.787878787878788, 2.6152639678030303, 5.304509943181818], "isController": false}, {"data": ["提交风控", 1, 0, 0.0, 478.0, 478, 478, 478.0, 478.0, 478.0, 2.092050209205021, 1.4444135721757323, 2.1982871338912133], "isController": false}, {"data": ["上传公司章程非标准附件", 1, 0, 0.0, 368.0, 368, 368, 368.0, 368.0, 368.0, 2.717391304347826, 1.8867824388586958, 2.5263247282608696], "isController": false}, {"data": ["上传两年一期末级科目余额表非标准附件", 1, 0, 0.0, 259.0, 259, 259, 259.0, 259.0, 259.0, 3.8610038610038613, 2.695915781853282, 3.7365769787644787], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Percentile 1
            case 8:
            // Percentile 2
            case 9:
            // Percentile 3
            case 10:
            // Throughput
            case 11:
            // Kbytes/s
            case 12:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 80, 0, null, null, null, null, null, null, null, null, null, null], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
