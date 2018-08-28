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
$(document).ready(function() {

    $(".click-title").mouseenter( function(    e){
        e.preventDefault();
        this.style.cursor="pointer";
    });
    $(".click-title").mousedown( function(event){
        event.preventDefault();
    });

    // Ugly code while this script is shared among several pages
    try{
        refreshHitsPerSecond(true);
    } catch(e){}
    try{
        refreshResponseTimeOverTime(true);
    } catch(e){}
    try{
        refreshResponseTimePercentiles();
    } catch(e){}
    $(".portlet-header").css("cursor", "auto");
});

var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

// Fixes time stamps
function fixTimeStamps(series, offset){
    $.each(series, function(index, item) {
        $.each(item.data, function(index, coord) {
            coord[0] += offset;
        });
    });
}

// Check if the specified jquery object is a graph
function isGraph(object){
    return object.data('plot') !== undefined;
}

/**
 * Export graph to a PNG
 */
function exportToPNG(graphName, target) {
    var plot = $("#"+graphName).data('plot');
    var flotCanvas = plot.getCanvas();
    var image = flotCanvas.toDataURL();
    image = image.replace("image/png", "image/octet-stream");
    
    var downloadAttrSupported = ("download" in document.createElement("a"));
    if(downloadAttrSupported === true) {
        target.download = graphName + ".png";
        target.href = image;
    }
    else {
        document.location.href = image;
    }
    
}

// Override the specified graph options to fit the requirements of an overview
function prepareOverviewOptions(graphOptions){
    var overviewOptions = {
        series: {
            shadowSize: 0,
            lines: {
                lineWidth: 1
            },
            points: {
                // Show points on overview only when linked graph does not show
                // lines
                show: getProperty('series.lines.show', graphOptions) == false,
                radius : 1
            }
        },
        xaxis: {
            ticks: 2,
            axisLabel: null
        },
        yaxis: {
            ticks: 2,
            axisLabel: null
        },
        legend: {
            show: false,
            container: null
        },
        grid: {
            hoverable: false
        },
        tooltip: false
    };
    return $.extend(true, {}, graphOptions, overviewOptions);
}

// Force axes boundaries using graph extra options
function prepareOptions(options, data) {
    options.canvas = true;
    var extraOptions = data.extraOptions;
    if(extraOptions !== undefined){
        var xOffset = options.xaxis.mode === "time" ? 28800000 : 0;
        var yOffset = options.yaxis.mode === "time" ? 28800000 : 0;

        if(!isNaN(extraOptions.minX))
        	options.xaxis.min = parseFloat(extraOptions.minX) + xOffset;
        
        if(!isNaN(extraOptions.maxX))
        	options.xaxis.max = parseFloat(extraOptions.maxX) + xOffset;
        
        if(!isNaN(extraOptions.minY))
        	options.yaxis.min = parseFloat(extraOptions.minY) + yOffset;
        
        if(!isNaN(extraOptions.maxY))
        	options.yaxis.max = parseFloat(extraOptions.maxY) + yOffset;
    }
}

// Filter, mark series and sort data
/**
 * @param data
 * @param noMatchColor if defined and true, series.color are not matched with index
 */
function prepareSeries(data, noMatchColor){
    var result = data.result;

    // Keep only series when needed
    if(seriesFilter && (!filtersOnlySampleSeries || result.supportsControllersDiscrimination)){
        // Insensitive case matching
        var regexp = new RegExp(seriesFilter, 'i');
        result.series = $.grep(result.series, function(series, index){
            return regexp.test(series.label);
        });
    }

    // Keep only controllers series when supported and needed
    if(result.supportsControllersDiscrimination && showControllersOnly){
        result.series = $.grep(result.series, function(series, index){
            return series.isController;
        });
    }

    // Sort data and mark series
    $.each(result.series, function(index, series) {
        series.data.sort(compareByXCoordinate);
        if(!(noMatchColor && noMatchColor===true)) {
	        series.color = index;
	    }
    });
}

// Set the zoom on the specified plot object
function zoomPlot(plot, xmin, xmax, ymin, ymax){
    var axes = plot.getAxes();
    // Override axes min and max options
    $.extend(true, axes, {
        xaxis: {
            options : { min: xmin, max: xmax }
        },
        yaxis: {
            options : { min: ymin, max: ymax }
        }
    });

    // Redraw the plot
    plot.setupGrid();
    plot.draw();
}

// Prepares DOM items to add zoom function on the specified graph
function setGraphZoomable(graphSelector, overviewSelector){
    var graph = $(graphSelector);
    var overview = $(overviewSelector);

    // Ignore mouse down event
    graph.bind("mousedown", function() { return false; });
    overview.bind("mousedown", function() { return false; });

    // Zoom on selection
    graph.bind("plotselected", function (event, ranges) {
        // clamp the zooming to prevent infinite zoom
        if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
            ranges.xaxis.to = ranges.xaxis.from + 0.00001;
        }
        if (ranges.yaxis.to - ranges.yaxis.from < 0.00001) {
            ranges.yaxis.to = ranges.yaxis.from + 0.00001;
        }

        // Do the zooming
        var plot = graph.data('plot');
        zoomPlot(plot, ranges.xaxis.from, ranges.xaxis.to, ranges.yaxis.from, ranges.yaxis.to);
        plot.clearSelection();

        // Synchronize overview selection
        overview.data('plot').setSelection(ranges, true);
    });

    // Zoom linked graph on overview selection
    overview.bind("plotselected", function (event, ranges) {
        graph.data('plot').setSelection(ranges);
    });

    // Reset linked graph zoom when reseting overview selection
    overview.bind("plotunselected", function () {
        var overviewAxes = overview.data('plot').getAxes();
        zoomPlot(graph.data('plot'), overviewAxes.xaxis.min, overviewAxes.xaxis.max, overviewAxes.yaxis.min, overviewAxes.yaxis.max);
    });
}

var responseTimePercentilesInfos = {
        getOptions: function() {
            return {
                series: {
                    points: { show: false }
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimePercentiles'
                },
                xaxis: {
                    tickDecimals: 1,
                    axisLabel: "Percentiles",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Percentile value in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : %x.2 percentile was %y ms"
                },
                selection: { mode: "xy" },
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimePercentiles"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimesPercentiles"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimesPercentiles"), dataset, prepareOverviewOptions(options));
        }
};

// Response times percentiles
function refreshResponseTimePercentiles() {
    var infos = responseTimePercentilesInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimesPercentiles"))){
        infos.createGraph();
    } else {
        var choiceContainer = $("#choicesResponseTimePercentiles");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimesPercentiles", "#overviewResponseTimesPercentiles");
        $('#bodyResponseTimePercentiles .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var responseTimeDistributionInfos = {
        data: {"result": {"minY": 1.0, "minX": 100.0, "maxY": 1.0, "series": [{"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成股东情况", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成实际控制人及持股比例", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传外部资金方情况标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传理财部门整体介绍非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "录入实际控制人及持股比例", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成对外负债情况", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传公司组织架构标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传产品类别及对应流程图、简介非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传主要部门负责人及简介标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传股权结构非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传股东情况标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成非标准附件(业务信息)", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成外部资金方情况", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "状态显示", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传人法、仲裁、失信情况标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传关联公司标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传产品大纲、盈利逻辑分析及具体收费标准非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传公司简介非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传业务模式、市场定位分析、主营业务竞争优势非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成业务总量概况", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传业务地域分布情况标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成近一年有息负债融资清单及相应的协议", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成关联公司", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成公司各月募资情况线下", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传关联方股权结构图非标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成公司各月募资情况线上", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传渠道、业务人员返点制度非标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成外部融资渠道最近一年的融资台账", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传Top5资金方协议非标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成理财部门整体介绍", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成尽调情况", "isController": false}, {"data": [[400.0, 1.0]], "isOverall": false, "label": "登录", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传营业执照非标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成商务部初审意见", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "录入尽调信息", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "查询资产方ZC0576", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传业务总量概况标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成企业基本情况", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成对外担保情况", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成业务门店分布情况", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成非标准附件(风控部门资料)", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传验资报告非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传近一年有息负债融资清单及相应的协议标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线上", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "录入企业工商信息", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线下", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线下", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线上", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成人法、仲裁、失信情况", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传外部融资渠道最近一年的融资台账标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成主要部门负责人及简介", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传客户进件资料与合同非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传业务门店分布情况标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传近一年每月代偿台账非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传客户、经销商、门店准入及筛选标准非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成公司组织架构", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成企业工商信息", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成非标准附件(财务信息)", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线下", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "录入企业基本情况", "isController": false}, {"data": [[300.0, 1.0]], "isOverall": false, "label": "上传对外负债情况标准附件", "isController": false}, {"data": [[100.0, 1.0]], "isOverall": false, "label": "确认完成融资情况", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "录入商务部初审意见", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传公司未来发展计划非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "创建资产方", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线上", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "确认完成业务地域分布情况", "isController": false}, {"data": [[400.0, 1.0]], "isOverall": false, "label": "提交审批", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传对外担保情况标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传近三年审计报告、咨询报告非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传公司股东、高级管理人员简历非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传融资情况标准附件", "isController": false}, {"data": [[400.0, 1.0]], "isOverall": false, "label": "提交风控", "isController": false}, {"data": [[300.0, 1.0]], "isOverall": false, "label": "上传公司章程非标准附件", "isController": false}, {"data": [[200.0, 1.0]], "isOverall": false, "label": "上传两年一期末级科目余额表非标准附件", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 100, "maxX": 400.0, "title": "Response Time Distribution"}},
        getOptions: function() {
            var granularity = this.data.result.granularity;
            return {
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimeDistribution'
                },
                xaxis:{
                    axisLabel: "Response times in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of responses",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                bars : {
                    show: true,
                    barWidth: this.data.result.granularity
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: function(label, xval, yval, flotItem){
                        return yval + " responses for " + label + " were between " + xval + " and " + (xval + granularity) + " ms";
                    }
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimeDistribution"), prepareData(data.result.series, $("#choicesResponseTimeDistribution")), options);
        }

};

// Response time distribution
function refreshResponseTimeDistribution() {
    var infos = responseTimeDistributionInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimeDistribution"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimeDistribution");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        $('#footerResponseTimeDistribution .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var syntheticResponseTimeDistributionInfos = {
        data: {"result": {"minY": 80.0, "minX": 0.0, "ticks": [[0, "Requests having \nresponse time <= 500ms"], [1, "Requests having \nresponse time > 500ms and <= 1,500ms"], [2, "Requests having \nresponse time > 1,500ms"], [3, "Requests in error"]], "maxY": 80.0, "series": [{"data": [[0.0, 80.0]], "isOverall": false, "label": "Requests having \nresponse time <= 500ms", "isController": false}], "supportsControllersDiscrimination": false, "maxX": 4.9E-324, "title": "Synthetic Response Times Distribution"}},
        getOptions: function() {
            return {
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendSyntheticResponseTimeDistribution'
                },
                xaxis:{
                    axisLabel: "Response times ranges",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                    tickLength:0,
                    min:-0.5,
                    max:3.5
                },
                yaxis: {
                    axisLabel: "Number of responses",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                bars : {
                    show: true,
                    align: "center",
                    barWidth: 0.25,
                    fill:.75
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: function(label, xval, yval, flotItem){
                        return yval + " " + label;
                    }
                },
                colors: ["#9ACD32", "yellow", "orange", "#FF6347"]                
            };
        },
        createGraph: function() {
            var data = this.data;
            var options = this.getOptions();
            prepareOptions(options, data);
            options.xaxis.ticks = data.result.ticks;
            $.plot($("#flotSyntheticResponseTimeDistribution"), prepareData(data.result.series, $("#choicesSyntheticResponseTimeDistribution")), options);
        }

};

// Response time distribution
function refreshSyntheticResponseTimeDistribution() {
    var infos = syntheticResponseTimeDistributionInfos;
    prepareSeries(infos.data, true);
    if (isGraph($("#flotSyntheticResponseTimeDistribution"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesSyntheticResponseTimeDistribution");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        $('#footerSyntheticResponseTimeDistribution .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var activeThreadsOverTimeInfos = {
        data: {"result": {"minY": 1.0, "minX": 1.53493698E12, "maxY": 1.0, "series": [{"data": [[1.53493698E12, 1.0], [1.53493704E12, 1.0]], "isOverall": false, "label": "资产方录入平台", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.53493704E12, "title": "Active Threads Over Time"}},
        getOptions: function() {
            return {
                series: {
                    stack: true,
                    lines: {
                        show: true,
                        fill: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of active threads",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 6,
                    show: true,
                    container: '#legendActiveThreadsOverTime'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                selection: {
                    mode: 'xy'
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : At %x there were %y active threads"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesActiveThreadsOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotActiveThreadsOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewActiveThreadsOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Active Threads Over Time
function refreshActiveThreadsOverTime(fixTimestamps) {
    var infos = activeThreadsOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotActiveThreadsOverTime"))) {
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesActiveThreadsOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotActiveThreadsOverTime", "#overviewActiveThreadsOverTime");
        $('#footerActiveThreadsOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var timeVsThreadsInfos = {
        data: {"result": {"minY": 187.0, "minX": 1.0, "maxY": 478.0, "series": [{"data": [[1.0, 199.0]], "isOverall": false, "label": "确认完成股东情况", "isController": false}, {"data": [[1.0, 199.0]], "isOverall": false, "label": "确认完成股东情况-Aggregated", "isController": false}, {"data": [[1.0, 207.0]], "isOverall": false, "label": "确认完成实际控制人及持股比例", "isController": false}, {"data": [[1.0, 207.0]], "isOverall": false, "label": "确认完成实际控制人及持股比例-Aggregated", "isController": false}, {"data": [[1.0, 262.0]], "isOverall": false, "label": "上传外部资金方情况标准附件", "isController": false}, {"data": [[1.0, 262.0]], "isOverall": false, "label": "上传外部资金方情况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 269.0]], "isOverall": false, "label": "上传理财部门整体介绍非标准附件", "isController": false}, {"data": [[1.0, 269.0]], "isOverall": false, "label": "上传理财部门整体介绍非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 252.0]], "isOverall": false, "label": "录入实际控制人及持股比例", "isController": false}, {"data": [[1.0, 252.0]], "isOverall": false, "label": "录入实际控制人及持股比例-Aggregated", "isController": false}, {"data": [[1.0, 193.0]], "isOverall": false, "label": "确认完成对外负债情况", "isController": false}, {"data": [[1.0, 193.0]], "isOverall": false, "label": "确认完成对外负债情况-Aggregated", "isController": false}, {"data": [[1.0, 254.0]], "isOverall": false, "label": "上传公司组织架构标准附件", "isController": false}, {"data": [[1.0, 254.0]], "isOverall": false, "label": "上传公司组织架构标准附件-Aggregated", "isController": false}, {"data": [[1.0, 240.0]], "isOverall": false, "label": "上传产品类别及对应流程图、简介非标准附件", "isController": false}, {"data": [[1.0, 240.0]], "isOverall": false, "label": "上传产品类别及对应流程图、简介非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 253.0]], "isOverall": false, "label": "上传主要部门负责人及简介标准附件", "isController": false}, {"data": [[1.0, 253.0]], "isOverall": false, "label": "上传主要部门负责人及简介标准附件-Aggregated", "isController": false}, {"data": [[1.0, 251.0]], "isOverall": false, "label": "上传股权结构非标准附件", "isController": false}, {"data": [[1.0, 251.0]], "isOverall": false, "label": "上传股权结构非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 266.0]], "isOverall": false, "label": "上传股东情况标准附件", "isController": false}, {"data": [[1.0, 266.0]], "isOverall": false, "label": "上传股东情况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 218.0]], "isOverall": false, "label": "确认完成非标准附件(业务信息)", "isController": false}, {"data": [[1.0, 218.0]], "isOverall": false, "label": "确认完成非标准附件(业务信息)-Aggregated", "isController": false}, {"data": [[1.0, 187.0]], "isOverall": false, "label": "确认完成外部资金方情况", "isController": false}, {"data": [[1.0, 187.0]], "isOverall": false, "label": "确认完成外部资金方情况-Aggregated", "isController": false}, {"data": [[1.0, 291.0]], "isOverall": false, "label": "状态显示", "isController": false}, {"data": [[1.0, 291.0]], "isOverall": false, "label": "状态显示-Aggregated", "isController": false}, {"data": [[1.0, 273.0]], "isOverall": false, "label": "上传人法、仲裁、失信情况标准附件", "isController": false}, {"data": [[1.0, 273.0]], "isOverall": false, "label": "上传人法、仲裁、失信情况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 270.0]], "isOverall": false, "label": "上传关联公司标准附件", "isController": false}, {"data": [[1.0, 270.0]], "isOverall": false, "label": "上传关联公司标准附件-Aggregated", "isController": false}, {"data": [[1.0, 240.0]], "isOverall": false, "label": "上传产品大纲、盈利逻辑分析及具体收费标准非标准附件", "isController": false}, {"data": [[1.0, 240.0]], "isOverall": false, "label": "上传产品大纲、盈利逻辑分析及具体收费标准非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 249.0]], "isOverall": false, "label": "上传公司简介非标准附件", "isController": false}, {"data": [[1.0, 249.0]], "isOverall": false, "label": "上传公司简介非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 248.0]], "isOverall": false, "label": "上传业务模式、市场定位分析、主营业务竞争优势非标准附件", "isController": false}, {"data": [[1.0, 248.0]], "isOverall": false, "label": "上传业务模式、市场定位分析、主营业务竞争优势非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 247.0]], "isOverall": false, "label": "上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件", "isController": false}, {"data": [[1.0, 247.0]], "isOverall": false, "label": "上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 188.0]], "isOverall": false, "label": "确认完成业务总量概况", "isController": false}, {"data": [[1.0, 188.0]], "isOverall": false, "label": "确认完成业务总量概况-Aggregated", "isController": false}, {"data": [[1.0, 278.0]], "isOverall": false, "label": "上传业务地域分布情况标准附件", "isController": false}, {"data": [[1.0, 278.0]], "isOverall": false, "label": "上传业务地域分布情况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 195.0]], "isOverall": false, "label": "确认完成近一年有息负债融资清单及相应的协议", "isController": false}, {"data": [[1.0, 195.0]], "isOverall": false, "label": "确认完成近一年有息负债融资清单及相应的协议-Aggregated", "isController": false}, {"data": [[1.0, 201.0]], "isOverall": false, "label": "确认完成关联公司", "isController": false}, {"data": [[1.0, 201.0]], "isOverall": false, "label": "确认完成关联公司-Aggregated", "isController": false}, {"data": [[1.0, 216.0]], "isOverall": false, "label": "确认完成公司各月募资情况线下", "isController": false}, {"data": [[1.0, 216.0]], "isOverall": false, "label": "确认完成公司各月募资情况线下-Aggregated", "isController": false}, {"data": [[1.0, 254.0]], "isOverall": false, "label": "上传关联方股权结构图非标准附件", "isController": false}, {"data": [[1.0, 254.0]], "isOverall": false, "label": "上传关联方股权结构图非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 198.0]], "isOverall": false, "label": "确认完成公司各月募资情况线上", "isController": false}, {"data": [[1.0, 198.0]], "isOverall": false, "label": "确认完成公司各月募资情况线上-Aggregated", "isController": false}, {"data": [[1.0, 239.0]], "isOverall": false, "label": "上传渠道、业务人员返点制度非标准附件", "isController": false}, {"data": [[1.0, 239.0]], "isOverall": false, "label": "上传渠道、业务人员返点制度非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 188.0]], "isOverall": false, "label": "确认完成外部融资渠道最近一年的融资台账", "isController": false}, {"data": [[1.0, 188.0]], "isOverall": false, "label": "确认完成外部融资渠道最近一年的融资台账-Aggregated", "isController": false}, {"data": [[1.0, 257.0]], "isOverall": false, "label": "上传Top5资金方协议非标准附件", "isController": false}, {"data": [[1.0, 257.0]], "isOverall": false, "label": "上传Top5资金方协议非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 195.0]], "isOverall": false, "label": "确认完成理财部门整体介绍", "isController": false}, {"data": [[1.0, 195.0]], "isOverall": false, "label": "确认完成理财部门整体介绍-Aggregated", "isController": false}, {"data": [[1.0, 193.0]], "isOverall": false, "label": "确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单", "isController": false}, {"data": [[1.0, 193.0]], "isOverall": false, "label": "确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单-Aggregated", "isController": false}, {"data": [[1.0, 209.0]], "isOverall": false, "label": "确认完成尽调情况", "isController": false}, {"data": [[1.0, 209.0]], "isOverall": false, "label": "确认完成尽调情况-Aggregated", "isController": false}, {"data": [[1.0, 437.0]], "isOverall": false, "label": "登录", "isController": false}, {"data": [[1.0, 437.0]], "isOverall": false, "label": "登录-Aggregated", "isController": false}, {"data": [[1.0, 249.0]], "isOverall": false, "label": "上传营业执照非标准附件", "isController": false}, {"data": [[1.0, 249.0]], "isOverall": false, "label": "上传营业执照非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 188.0]], "isOverall": false, "label": "确认完成商务部初审意见", "isController": false}, {"data": [[1.0, 188.0]], "isOverall": false, "label": "确认完成商务部初审意见-Aggregated", "isController": false}, {"data": [[1.0, 286.0]], "isOverall": false, "label": "录入尽调信息", "isController": false}, {"data": [[1.0, 286.0]], "isOverall": false, "label": "录入尽调信息-Aggregated", "isController": false}, {"data": [[1.0, 252.0]], "isOverall": false, "label": "查询资产方ZC0576", "isController": false}, {"data": [[1.0, 252.0]], "isOverall": false, "label": "查询资产方ZC0576-Aggregated", "isController": false}, {"data": [[1.0, 248.0]], "isOverall": false, "label": "上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件", "isController": false}, {"data": [[1.0, 248.0]], "isOverall": false, "label": "上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 286.0]], "isOverall": false, "label": "上传业务总量概况标准附件", "isController": false}, {"data": [[1.0, 286.0]], "isOverall": false, "label": "上传业务总量概况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 188.0]], "isOverall": false, "label": "确认完成企业基本情况", "isController": false}, {"data": [[1.0, 188.0]], "isOverall": false, "label": "确认完成企业基本情况-Aggregated", "isController": false}, {"data": [[1.0, 187.0]], "isOverall": false, "label": "确认完成对外担保情况", "isController": false}, {"data": [[1.0, 187.0]], "isOverall": false, "label": "确认完成对外担保情况-Aggregated", "isController": false}, {"data": [[1.0, 195.0]], "isOverall": false, "label": "确认完成业务门店分布情况", "isController": false}, {"data": [[1.0, 195.0]], "isOverall": false, "label": "确认完成业务门店分布情况-Aggregated", "isController": false}, {"data": [[1.0, 208.0]], "isOverall": false, "label": "确认完成非标准附件(风控部门资料)", "isController": false}, {"data": [[1.0, 208.0]], "isOverall": false, "label": "确认完成非标准附件(风控部门资料)-Aggregated", "isController": false}, {"data": [[1.0, 277.0]], "isOverall": false, "label": "上传验资报告非标准附件", "isController": false}, {"data": [[1.0, 277.0]], "isOverall": false, "label": "上传验资报告非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 286.0]], "isOverall": false, "label": "上传近一年有息负债融资清单及相应的协议标准附件", "isController": false}, {"data": [[1.0, 286.0]], "isOverall": false, "label": "上传近一年有息负债融资清单及相应的协议标准附件-Aggregated", "isController": false}, {"data": [[1.0, 262.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线上", "isController": false}, {"data": [[1.0, 262.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线上-Aggregated", "isController": false}, {"data": [[1.0, 265.0]], "isOverall": false, "label": "录入企业工商信息", "isController": false}, {"data": [[1.0, 265.0]], "isOverall": false, "label": "录入企业工商信息-Aggregated", "isController": false}, {"data": [[1.0, 270.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线下", "isController": false}, {"data": [[1.0, 270.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线下-Aggregated", "isController": false}, {"data": [[1.0, 258.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线下", "isController": false}, {"data": [[1.0, 258.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线下-Aggregated", "isController": false}, {"data": [[1.0, 246.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线上", "isController": false}, {"data": [[1.0, 246.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线上-Aggregated", "isController": false}, {"data": [[1.0, 189.0]], "isOverall": false, "label": "确认完成人法、仲裁、失信情况", "isController": false}, {"data": [[1.0, 189.0]], "isOverall": false, "label": "确认完成人法、仲裁、失信情况-Aggregated", "isController": false}, {"data": [[1.0, 255.0]], "isOverall": false, "label": "上传外部融资渠道最近一年的融资台账标准附件", "isController": false}, {"data": [[1.0, 255.0]], "isOverall": false, "label": "上传外部融资渠道最近一年的融资台账标准附件-Aggregated", "isController": false}, {"data": [[1.0, 194.0]], "isOverall": false, "label": "确认完成主要部门负责人及简介", "isController": false}, {"data": [[1.0, 194.0]], "isOverall": false, "label": "确认完成主要部门负责人及简介-Aggregated", "isController": false}, {"data": [[1.0, 254.0]], "isOverall": false, "label": "上传客户进件资料与合同非标准附件", "isController": false}, {"data": [[1.0, 254.0]], "isOverall": false, "label": "上传客户进件资料与合同非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 264.0]], "isOverall": false, "label": "上传业务门店分布情况标准附件", "isController": false}, {"data": [[1.0, 264.0]], "isOverall": false, "label": "上传业务门店分布情况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 235.0]], "isOverall": false, "label": "上传近一年每月代偿台账非标准附件", "isController": false}, {"data": [[1.0, 235.0]], "isOverall": false, "label": "上传近一年每月代偿台账非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 266.0]], "isOverall": false, "label": "上传客户、经销商、门店准入及筛选标准非标准附件", "isController": false}, {"data": [[1.0, 266.0]], "isOverall": false, "label": "上传客户、经销商、门店准入及筛选标准非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 248.0]], "isOverall": false, "label": "上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件", "isController": false}, {"data": [[1.0, 248.0]], "isOverall": false, "label": "上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件-Aggregated", "isController": false}, {"data": [[1.0, 193.0]], "isOverall": false, "label": "确认完成公司组织架构", "isController": false}, {"data": [[1.0, 193.0]], "isOverall": false, "label": "确认完成公司组织架构-Aggregated", "isController": false}, {"data": [[1.0, 199.0]], "isOverall": false, "label": "确认完成企业工商信息", "isController": false}, {"data": [[1.0, 199.0]], "isOverall": false, "label": "确认完成企业工商信息-Aggregated", "isController": false}, {"data": [[1.0, 232.0]], "isOverall": false, "label": "确认完成非标准附件(财务信息)", "isController": false}, {"data": [[1.0, 232.0]], "isOverall": false, "label": "确认完成非标准附件(财务信息)-Aggregated", "isController": false}, {"data": [[1.0, 191.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线下", "isController": false}, {"data": [[1.0, 191.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线下-Aggregated", "isController": false}, {"data": [[1.0, 292.0]], "isOverall": false, "label": "录入企业基本情况", "isController": false}, {"data": [[1.0, 292.0]], "isOverall": false, "label": "录入企业基本情况-Aggregated", "isController": false}, {"data": [[1.0, 304.0]], "isOverall": false, "label": "上传对外负债情况标准附件", "isController": false}, {"data": [[1.0, 304.0]], "isOverall": false, "label": "上传对外负债情况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 189.0]], "isOverall": false, "label": "确认完成融资情况", "isController": false}, {"data": [[1.0, 189.0]], "isOverall": false, "label": "确认完成融资情况-Aggregated", "isController": false}, {"data": [[1.0, 250.0]], "isOverall": false, "label": "录入商务部初审意见", "isController": false}, {"data": [[1.0, 250.0]], "isOverall": false, "label": "录入商务部初审意见-Aggregated", "isController": false}, {"data": [[1.0, 249.0]], "isOverall": false, "label": "上传公司未来发展计划非标准附件", "isController": false}, {"data": [[1.0, 249.0]], "isOverall": false, "label": "上传公司未来发展计划非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 224.0]], "isOverall": false, "label": "创建资产方", "isController": false}, {"data": [[1.0, 224.0]], "isOverall": false, "label": "创建资产方-Aggregated", "isController": false}, {"data": [[1.0, 208.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线上", "isController": false}, {"data": [[1.0, 208.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线上-Aggregated", "isController": false}, {"data": [[1.0, 203.0]], "isOverall": false, "label": "确认完成业务地域分布情况", "isController": false}, {"data": [[1.0, 203.0]], "isOverall": false, "label": "确认完成业务地域分布情况-Aggregated", "isController": false}, {"data": [[1.0, 472.0]], "isOverall": false, "label": "提交审批", "isController": false}, {"data": [[1.0, 472.0]], "isOverall": false, "label": "提交审批-Aggregated", "isController": false}, {"data": [[1.0, 248.0]], "isOverall": false, "label": "上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件", "isController": false}, {"data": [[1.0, 248.0]], "isOverall": false, "label": "上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 277.0]], "isOverall": false, "label": "上传对外担保情况标准附件", "isController": false}, {"data": [[1.0, 277.0]], "isOverall": false, "label": "上传对外担保情况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 242.0]], "isOverall": false, "label": "上传近三年审计报告、咨询报告非标准附件", "isController": false}, {"data": [[1.0, 242.0]], "isOverall": false, "label": "上传近三年审计报告、咨询报告非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 256.0]], "isOverall": false, "label": "上传公司股东、高级管理人员简历非标准附件", "isController": false}, {"data": [[1.0, 256.0]], "isOverall": false, "label": "上传公司股东、高级管理人员简历非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 264.0]], "isOverall": false, "label": "上传融资情况标准附件", "isController": false}, {"data": [[1.0, 264.0]], "isOverall": false, "label": "上传融资情况标准附件-Aggregated", "isController": false}, {"data": [[1.0, 478.0]], "isOverall": false, "label": "提交风控", "isController": false}, {"data": [[1.0, 478.0]], "isOverall": false, "label": "提交风控-Aggregated", "isController": false}, {"data": [[1.0, 368.0]], "isOverall": false, "label": "上传公司章程非标准附件", "isController": false}, {"data": [[1.0, 368.0]], "isOverall": false, "label": "上传公司章程非标准附件-Aggregated", "isController": false}, {"data": [[1.0, 259.0]], "isOverall": false, "label": "上传两年一期末级科目余额表非标准附件", "isController": false}, {"data": [[1.0, 259.0]], "isOverall": false, "label": "上传两年一期末级科目余额表非标准附件-Aggregated", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 1.0, "title": "Time VS Threads"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    axisLabel: "Number of active threads",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response times in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: { noColumns: 2,show: true, container: '#legendTimeVsThreads' },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s: At %x.2 active threads, Average response time was %y.2 ms"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesTimeVsThreads"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotTimesVsThreads"), dataset, options);
            // setup overview
            $.plot($("#overviewTimesVsThreads"), dataset, prepareOverviewOptions(options));
        }
};

// Time vs threads
function refreshTimeVsThreads(){
    var infos = timeVsThreadsInfos;
    prepareSeries(infos.data);
    if(isGraph($("#flotTimesVsThreads"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTimeVsThreads");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTimesVsThreads", "#overviewTimesVsThreads");
        $('#footerTimeVsThreads .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var bytesThroughputOverTimeInfos = {
        data : {"result": {"minY": 27.783333333333335, "minX": 1.53493698E12, "maxY": 1281.6333333333334, "series": [{"data": [[1.53493698E12, 41.36666666666667], [1.53493704E12, 934.4666666666667]], "isOverall": false, "label": "Bytes received per second", "isController": false}, {"data": [[1.53493698E12, 27.783333333333335], [1.53493704E12, 1281.6333333333334]], "isOverall": false, "label": "Bytes sent per second", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.53493704E12, "title": "Bytes Throughput Over Time"}},
        getOptions : function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity) ,
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Bytes / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendBytesThroughputOverTime'
                },
                selection: {
                    mode: "xy"
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y"
                }
            };
        },
        createGraph : function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesBytesThroughputOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotBytesThroughputOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewBytesThroughputOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Bytes throughput Over Time
function refreshBytesThroughputOverTime(fixTimestamps) {
    var infos = bytesThroughputOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotBytesThroughputOverTime"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesBytesThroughputOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotBytesThroughputOverTime", "#overviewBytesThroughputOverTime");
        $('#footerBytesThroughputOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var responseTimesOverTimeInfos = {
        data: {"result": {"minY": 187.0, "minX": 1.53493698E12, "maxY": 478.0, "series": [{"data": [[1.53493704E12, 199.0]], "isOverall": false, "label": "确认完成股东情况", "isController": false}, {"data": [[1.53493704E12, 207.0]], "isOverall": false, "label": "确认完成实际控制人及持股比例", "isController": false}, {"data": [[1.53493704E12, 262.0]], "isOverall": false, "label": "上传外部资金方情况标准附件", "isController": false}, {"data": [[1.53493704E12, 269.0]], "isOverall": false, "label": "上传理财部门整体介绍非标准附件", "isController": false}, {"data": [[1.53493704E12, 252.0]], "isOverall": false, "label": "录入实际控制人及持股比例", "isController": false}, {"data": [[1.53493704E12, 193.0]], "isOverall": false, "label": "确认完成对外负债情况", "isController": false}, {"data": [[1.53493704E12, 254.0]], "isOverall": false, "label": "上传公司组织架构标准附件", "isController": false}, {"data": [[1.53493704E12, 240.0]], "isOverall": false, "label": "上传产品类别及对应流程图、简介非标准附件", "isController": false}, {"data": [[1.53493704E12, 253.0]], "isOverall": false, "label": "上传主要部门负责人及简介标准附件", "isController": false}, {"data": [[1.53493704E12, 251.0]], "isOverall": false, "label": "上传股权结构非标准附件", "isController": false}, {"data": [[1.53493704E12, 266.0]], "isOverall": false, "label": "上传股东情况标准附件", "isController": false}, {"data": [[1.53493704E12, 218.0]], "isOverall": false, "label": "确认完成非标准附件(业务信息)", "isController": false}, {"data": [[1.53493704E12, 187.0]], "isOverall": false, "label": "确认完成外部资金方情况", "isController": false}, {"data": [[1.53493704E12, 291.0]], "isOverall": false, "label": "状态显示", "isController": false}, {"data": [[1.53493704E12, 273.0]], "isOverall": false, "label": "上传人法、仲裁、失信情况标准附件", "isController": false}, {"data": [[1.53493704E12, 270.0]], "isOverall": false, "label": "上传关联公司标准附件", "isController": false}, {"data": [[1.53493704E12, 240.0]], "isOverall": false, "label": "上传产品大纲、盈利逻辑分析及具体收费标准非标准附件", "isController": false}, {"data": [[1.53493704E12, 249.0]], "isOverall": false, "label": "上传公司简介非标准附件", "isController": false}, {"data": [[1.53493704E12, 248.0]], "isOverall": false, "label": "上传业务模式、市场定位分析、主营业务竞争优势非标准附件", "isController": false}, {"data": [[1.53493704E12, 247.0]], "isOverall": false, "label": "上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件", "isController": false}, {"data": [[1.53493704E12, 188.0]], "isOverall": false, "label": "确认完成业务总量概况", "isController": false}, {"data": [[1.53493704E12, 278.0]], "isOverall": false, "label": "上传业务地域分布情况标准附件", "isController": false}, {"data": [[1.53493704E12, 195.0]], "isOverall": false, "label": "确认完成近一年有息负债融资清单及相应的协议", "isController": false}, {"data": [[1.53493704E12, 201.0]], "isOverall": false, "label": "确认完成关联公司", "isController": false}, {"data": [[1.53493704E12, 216.0]], "isOverall": false, "label": "确认完成公司各月募资情况线下", "isController": false}, {"data": [[1.53493704E12, 254.0]], "isOverall": false, "label": "上传关联方股权结构图非标准附件", "isController": false}, {"data": [[1.53493704E12, 198.0]], "isOverall": false, "label": "确认完成公司各月募资情况线上", "isController": false}, {"data": [[1.53493704E12, 239.0]], "isOverall": false, "label": "上传渠道、业务人员返点制度非标准附件", "isController": false}, {"data": [[1.53493704E12, 188.0]], "isOverall": false, "label": "确认完成外部融资渠道最近一年的融资台账", "isController": false}, {"data": [[1.53493704E12, 257.0]], "isOverall": false, "label": "上传Top5资金方协议非标准附件", "isController": false}, {"data": [[1.53493704E12, 195.0]], "isOverall": false, "label": "确认完成理财部门整体介绍", "isController": false}, {"data": [[1.53493704E12, 193.0]], "isOverall": false, "label": "确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单", "isController": false}, {"data": [[1.53493704E12, 209.0]], "isOverall": false, "label": "确认完成尽调情况", "isController": false}, {"data": [[1.53493698E12, 437.0]], "isOverall": false, "label": "登录", "isController": false}, {"data": [[1.53493704E12, 249.0]], "isOverall": false, "label": "上传营业执照非标准附件", "isController": false}, {"data": [[1.53493704E12, 188.0]], "isOverall": false, "label": "确认完成商务部初审意见", "isController": false}, {"data": [[1.53493704E12, 286.0]], "isOverall": false, "label": "录入尽调信息", "isController": false}, {"data": [[1.53493698E12, 252.0]], "isOverall": false, "label": "查询资产方ZC0576", "isController": false}, {"data": [[1.53493704E12, 248.0]], "isOverall": false, "label": "上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件", "isController": false}, {"data": [[1.53493704E12, 286.0]], "isOverall": false, "label": "上传业务总量概况标准附件", "isController": false}, {"data": [[1.53493704E12, 188.0]], "isOverall": false, "label": "确认完成企业基本情况", "isController": false}, {"data": [[1.53493704E12, 187.0]], "isOverall": false, "label": "确认完成对外担保情况", "isController": false}, {"data": [[1.53493704E12, 195.0]], "isOverall": false, "label": "确认完成业务门店分布情况", "isController": false}, {"data": [[1.53493704E12, 208.0]], "isOverall": false, "label": "确认完成非标准附件(风控部门资料)", "isController": false}, {"data": [[1.53493704E12, 277.0]], "isOverall": false, "label": "上传验资报告非标准附件", "isController": false}, {"data": [[1.53493704E12, 286.0]], "isOverall": false, "label": "上传近一年有息负债融资清单及相应的协议标准附件", "isController": false}, {"data": [[1.53493704E12, 262.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线上", "isController": false}, {"data": [[1.53493704E12, 265.0]], "isOverall": false, "label": "录入企业工商信息", "isController": false}, {"data": [[1.53493704E12, 270.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线下", "isController": false}, {"data": [[1.53493704E12, 258.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线下", "isController": false}, {"data": [[1.53493704E12, 246.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线上", "isController": false}, {"data": [[1.53493704E12, 189.0]], "isOverall": false, "label": "确认完成人法、仲裁、失信情况", "isController": false}, {"data": [[1.53493704E12, 255.0]], "isOverall": false, "label": "上传外部融资渠道最近一年的融资台账标准附件", "isController": false}, {"data": [[1.53493704E12, 194.0]], "isOverall": false, "label": "确认完成主要部门负责人及简介", "isController": false}, {"data": [[1.53493704E12, 254.0]], "isOverall": false, "label": "上传客户进件资料与合同非标准附件", "isController": false}, {"data": [[1.53493704E12, 264.0]], "isOverall": false, "label": "上传业务门店分布情况标准附件", "isController": false}, {"data": [[1.53493704E12, 235.0]], "isOverall": false, "label": "上传近一年每月代偿台账非标准附件", "isController": false}, {"data": [[1.53493704E12, 266.0]], "isOverall": false, "label": "上传客户、经销商、门店准入及筛选标准非标准附件", "isController": false}, {"data": [[1.53493704E12, 248.0]], "isOverall": false, "label": "上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件", "isController": false}, {"data": [[1.53493704E12, 193.0]], "isOverall": false, "label": "确认完成公司组织架构", "isController": false}, {"data": [[1.53493704E12, 199.0]], "isOverall": false, "label": "确认完成企业工商信息", "isController": false}, {"data": [[1.53493704E12, 232.0]], "isOverall": false, "label": "确认完成非标准附件(财务信息)", "isController": false}, {"data": [[1.53493704E12, 191.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线下", "isController": false}, {"data": [[1.53493704E12, 292.0]], "isOverall": false, "label": "录入企业基本情况", "isController": false}, {"data": [[1.53493704E12, 304.0]], "isOverall": false, "label": "上传对外负债情况标准附件", "isController": false}, {"data": [[1.53493704E12, 189.0]], "isOverall": false, "label": "确认完成融资情况", "isController": false}, {"data": [[1.53493704E12, 250.0]], "isOverall": false, "label": "录入商务部初审意见", "isController": false}, {"data": [[1.53493704E12, 249.0]], "isOverall": false, "label": "上传公司未来发展计划非标准附件", "isController": false}, {"data": [[1.53493698E12, 224.0]], "isOverall": false, "label": "创建资产方", "isController": false}, {"data": [[1.53493704E12, 208.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线上", "isController": false}, {"data": [[1.53493704E12, 203.0]], "isOverall": false, "label": "确认完成业务地域分布情况", "isController": false}, {"data": [[1.53493704E12, 472.0]], "isOverall": false, "label": "提交审批", "isController": false}, {"data": [[1.53493704E12, 248.0]], "isOverall": false, "label": "上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件", "isController": false}, {"data": [[1.53493704E12, 277.0]], "isOverall": false, "label": "上传对外担保情况标准附件", "isController": false}, {"data": [[1.53493704E12, 242.0]], "isOverall": false, "label": "上传近三年审计报告、咨询报告非标准附件", "isController": false}, {"data": [[1.53493704E12, 256.0]], "isOverall": false, "label": "上传公司股东、高级管理人员简历非标准附件", "isController": false}, {"data": [[1.53493704E12, 264.0]], "isOverall": false, "label": "上传融资情况标准附件", "isController": false}, {"data": [[1.53493704E12, 478.0]], "isOverall": false, "label": "提交风控", "isController": false}, {"data": [[1.53493704E12, 368.0]], "isOverall": false, "label": "上传公司章程非标准附件", "isController": false}, {"data": [[1.53493704E12, 259.0]], "isOverall": false, "label": "上传两年一期末级科目余额表非标准附件", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.53493704E12, "title": "Response Time Over Time"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average response time was %y ms"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Response Times Over Time
function refreshResponseTimeOverTime(fixTimestamps) {
    var infos = responseTimesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotResponseTimesOverTime"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimesOverTime", "#overviewResponseTimesOverTime");
        $('#footerResponseTimesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var latenciesOverTimeInfos = {
        data: {"result": {"minY": 187.0, "minX": 1.53493698E12, "maxY": 478.0, "series": [{"data": [[1.53493704E12, 199.0]], "isOverall": false, "label": "确认完成股东情况", "isController": false}, {"data": [[1.53493704E12, 207.0]], "isOverall": false, "label": "确认完成实际控制人及持股比例", "isController": false}, {"data": [[1.53493704E12, 262.0]], "isOverall": false, "label": "上传外部资金方情况标准附件", "isController": false}, {"data": [[1.53493704E12, 269.0]], "isOverall": false, "label": "上传理财部门整体介绍非标准附件", "isController": false}, {"data": [[1.53493704E12, 252.0]], "isOverall": false, "label": "录入实际控制人及持股比例", "isController": false}, {"data": [[1.53493704E12, 193.0]], "isOverall": false, "label": "确认完成对外负债情况", "isController": false}, {"data": [[1.53493704E12, 254.0]], "isOverall": false, "label": "上传公司组织架构标准附件", "isController": false}, {"data": [[1.53493704E12, 240.0]], "isOverall": false, "label": "上传产品类别及对应流程图、简介非标准附件", "isController": false}, {"data": [[1.53493704E12, 253.0]], "isOverall": false, "label": "上传主要部门负责人及简介标准附件", "isController": false}, {"data": [[1.53493704E12, 251.0]], "isOverall": false, "label": "上传股权结构非标准附件", "isController": false}, {"data": [[1.53493704E12, 266.0]], "isOverall": false, "label": "上传股东情况标准附件", "isController": false}, {"data": [[1.53493704E12, 218.0]], "isOverall": false, "label": "确认完成非标准附件(业务信息)", "isController": false}, {"data": [[1.53493704E12, 187.0]], "isOverall": false, "label": "确认完成外部资金方情况", "isController": false}, {"data": [[1.53493704E12, 291.0]], "isOverall": false, "label": "状态显示", "isController": false}, {"data": [[1.53493704E12, 273.0]], "isOverall": false, "label": "上传人法、仲裁、失信情况标准附件", "isController": false}, {"data": [[1.53493704E12, 270.0]], "isOverall": false, "label": "上传关联公司标准附件", "isController": false}, {"data": [[1.53493704E12, 240.0]], "isOverall": false, "label": "上传产品大纲、盈利逻辑分析及具体收费标准非标准附件", "isController": false}, {"data": [[1.53493704E12, 249.0]], "isOverall": false, "label": "上传公司简介非标准附件", "isController": false}, {"data": [[1.53493704E12, 248.0]], "isOverall": false, "label": "上传业务模式、市场定位分析、主营业务竞争优势非标准附件", "isController": false}, {"data": [[1.53493704E12, 247.0]], "isOverall": false, "label": "上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件", "isController": false}, {"data": [[1.53493704E12, 188.0]], "isOverall": false, "label": "确认完成业务总量概况", "isController": false}, {"data": [[1.53493704E12, 278.0]], "isOverall": false, "label": "上传业务地域分布情况标准附件", "isController": false}, {"data": [[1.53493704E12, 195.0]], "isOverall": false, "label": "确认完成近一年有息负债融资清单及相应的协议", "isController": false}, {"data": [[1.53493704E12, 200.0]], "isOverall": false, "label": "确认完成关联公司", "isController": false}, {"data": [[1.53493704E12, 216.0]], "isOverall": false, "label": "确认完成公司各月募资情况线下", "isController": false}, {"data": [[1.53493704E12, 254.0]], "isOverall": false, "label": "上传关联方股权结构图非标准附件", "isController": false}, {"data": [[1.53493704E12, 198.0]], "isOverall": false, "label": "确认完成公司各月募资情况线上", "isController": false}, {"data": [[1.53493704E12, 239.0]], "isOverall": false, "label": "上传渠道、业务人员返点制度非标准附件", "isController": false}, {"data": [[1.53493704E12, 188.0]], "isOverall": false, "label": "确认完成外部融资渠道最近一年的融资台账", "isController": false}, {"data": [[1.53493704E12, 257.0]], "isOverall": false, "label": "上传Top5资金方协议非标准附件", "isController": false}, {"data": [[1.53493704E12, 195.0]], "isOverall": false, "label": "确认完成理财部门整体介绍", "isController": false}, {"data": [[1.53493704E12, 193.0]], "isOverall": false, "label": "确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单", "isController": false}, {"data": [[1.53493704E12, 209.0]], "isOverall": false, "label": "确认完成尽调情况", "isController": false}, {"data": [[1.53493698E12, 437.0]], "isOverall": false, "label": "登录", "isController": false}, {"data": [[1.53493704E12, 249.0]], "isOverall": false, "label": "上传营业执照非标准附件", "isController": false}, {"data": [[1.53493704E12, 188.0]], "isOverall": false, "label": "确认完成商务部初审意见", "isController": false}, {"data": [[1.53493704E12, 286.0]], "isOverall": false, "label": "录入尽调信息", "isController": false}, {"data": [[1.53493698E12, 251.0]], "isOverall": false, "label": "查询资产方ZC0576", "isController": false}, {"data": [[1.53493704E12, 247.0]], "isOverall": false, "label": "上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件", "isController": false}, {"data": [[1.53493704E12, 286.0]], "isOverall": false, "label": "上传业务总量概况标准附件", "isController": false}, {"data": [[1.53493704E12, 188.0]], "isOverall": false, "label": "确认完成企业基本情况", "isController": false}, {"data": [[1.53493704E12, 187.0]], "isOverall": false, "label": "确认完成对外担保情况", "isController": false}, {"data": [[1.53493704E12, 195.0]], "isOverall": false, "label": "确认完成业务门店分布情况", "isController": false}, {"data": [[1.53493704E12, 208.0]], "isOverall": false, "label": "确认完成非标准附件(风控部门资料)", "isController": false}, {"data": [[1.53493704E12, 277.0]], "isOverall": false, "label": "上传验资报告非标准附件", "isController": false}, {"data": [[1.53493704E12, 286.0]], "isOverall": false, "label": "上传近一年有息负债融资清单及相应的协议标准附件", "isController": false}, {"data": [[1.53493704E12, 262.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线上", "isController": false}, {"data": [[1.53493704E12, 265.0]], "isOverall": false, "label": "录入企业工商信息", "isController": false}, {"data": [[1.53493704E12, 270.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线下", "isController": false}, {"data": [[1.53493704E12, 258.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线下", "isController": false}, {"data": [[1.53493704E12, 246.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线上", "isController": false}, {"data": [[1.53493704E12, 189.0]], "isOverall": false, "label": "确认完成人法、仲裁、失信情况", "isController": false}, {"data": [[1.53493704E12, 255.0]], "isOverall": false, "label": "上传外部融资渠道最近一年的融资台账标准附件", "isController": false}, {"data": [[1.53493704E12, 194.0]], "isOverall": false, "label": "确认完成主要部门负责人及简介", "isController": false}, {"data": [[1.53493704E12, 254.0]], "isOverall": false, "label": "上传客户进件资料与合同非标准附件", "isController": false}, {"data": [[1.53493704E12, 264.0]], "isOverall": false, "label": "上传业务门店分布情况标准附件", "isController": false}, {"data": [[1.53493704E12, 235.0]], "isOverall": false, "label": "上传近一年每月代偿台账非标准附件", "isController": false}, {"data": [[1.53493704E12, 266.0]], "isOverall": false, "label": "上传客户、经销商、门店准入及筛选标准非标准附件", "isController": false}, {"data": [[1.53493704E12, 248.0]], "isOverall": false, "label": "上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件", "isController": false}, {"data": [[1.53493704E12, 192.0]], "isOverall": false, "label": "确认完成公司组织架构", "isController": false}, {"data": [[1.53493704E12, 199.0]], "isOverall": false, "label": "确认完成企业工商信息", "isController": false}, {"data": [[1.53493704E12, 232.0]], "isOverall": false, "label": "确认完成非标准附件(财务信息)", "isController": false}, {"data": [[1.53493704E12, 191.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线下", "isController": false}, {"data": [[1.53493704E12, 292.0]], "isOverall": false, "label": "录入企业基本情况", "isController": false}, {"data": [[1.53493704E12, 304.0]], "isOverall": false, "label": "上传对外负债情况标准附件", "isController": false}, {"data": [[1.53493704E12, 189.0]], "isOverall": false, "label": "确认完成融资情况", "isController": false}, {"data": [[1.53493704E12, 250.0]], "isOverall": false, "label": "录入商务部初审意见", "isController": false}, {"data": [[1.53493704E12, 249.0]], "isOverall": false, "label": "上传公司未来发展计划非标准附件", "isController": false}, {"data": [[1.53493698E12, 224.0]], "isOverall": false, "label": "创建资产方", "isController": false}, {"data": [[1.53493704E12, 208.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线上", "isController": false}, {"data": [[1.53493704E12, 203.0]], "isOverall": false, "label": "确认完成业务地域分布情况", "isController": false}, {"data": [[1.53493704E12, 472.0]], "isOverall": false, "label": "提交审批", "isController": false}, {"data": [[1.53493704E12, 248.0]], "isOverall": false, "label": "上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件", "isController": false}, {"data": [[1.53493704E12, 277.0]], "isOverall": false, "label": "上传对外担保情况标准附件", "isController": false}, {"data": [[1.53493704E12, 242.0]], "isOverall": false, "label": "上传近三年审计报告、咨询报告非标准附件", "isController": false}, {"data": [[1.53493704E12, 256.0]], "isOverall": false, "label": "上传公司股东、高级管理人员简历非标准附件", "isController": false}, {"data": [[1.53493704E12, 264.0]], "isOverall": false, "label": "上传融资情况标准附件", "isController": false}, {"data": [[1.53493704E12, 478.0]], "isOverall": false, "label": "提交风控", "isController": false}, {"data": [[1.53493704E12, 368.0]], "isOverall": false, "label": "上传公司章程非标准附件", "isController": false}, {"data": [[1.53493704E12, 259.0]], "isOverall": false, "label": "上传两年一期末级科目余额表非标准附件", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.53493704E12, "title": "Latencies Over Time"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response latencies in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendLatenciesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average latency was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesLatenciesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotLatenciesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewLatenciesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Latencies Over Time
function refreshLatenciesOverTime(fixTimestamps) {
    var infos = latenciesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotLatenciesOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesLatenciesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotLatenciesOverTime", "#overviewLatenciesOverTime");
        $('#footerLatenciesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var connectTimeOverTimeInfos = {
        data: {"result": {"minY": 0.0, "minX": 1.53493698E12, "maxY": 75.0, "series": [{"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成股东情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成实际控制人及持股比例", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传外部资金方情况标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传理财部门整体介绍非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "录入实际控制人及持股比例", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成对外负债情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司组织架构标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传产品类别及对应流程图、简介非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传主要部门负责人及简介标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传股权结构非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传股东情况标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成非标准附件(业务信息)", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成外部资金方情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "状态显示", "isController": false}, {"data": [[1.53493704E12, 12.0]], "isOverall": false, "label": "上传人法、仲裁、失信情况标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传关联公司标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传产品大纲、盈利逻辑分析及具体收费标准非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司简介非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传业务模式、市场定位分析、主营业务竞争优势非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成业务总量概况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传业务地域分布情况标准附件", "isController": false}, {"data": [[1.53493704E12, 3.0]], "isOverall": false, "label": "确认完成近一年有息负债融资清单及相应的协议", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成关联公司", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成公司各月募资情况线下", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传关联方股权结构图非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成公司各月募资情况线上", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传渠道、业务人员返点制度非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成外部融资渠道最近一年的融资台账", "isController": false}, {"data": [[1.53493704E12, 6.0]], "isOverall": false, "label": "上传Top5资金方协议非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成理财部门整体介绍", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单", "isController": false}, {"data": [[1.53493704E12, 22.0]], "isOverall": false, "label": "确认完成尽调情况", "isController": false}, {"data": [[1.53493698E12, 75.0]], "isOverall": false, "label": "登录", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传营业执照非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成商务部初审意见", "isController": false}, {"data": [[1.53493704E12, 18.0]], "isOverall": false, "label": "录入尽调信息", "isController": false}, {"data": [[1.53493698E12, 0.0]], "isOverall": false, "label": "查询资产方ZC0576", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传业务总量概况标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成企业基本情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成对外担保情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成业务门店分布情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成非标准附件(风控部门资料)", "isController": false}, {"data": [[1.53493704E12, 19.0]], "isOverall": false, "label": "上传验资报告非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传近一年有息负债融资清单及相应的协议标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线上", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "录入企业工商信息", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线下", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线下", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司各月募资情况标准附件线上", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成人法、仲裁、失信情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传外部融资渠道最近一年的融资台账标准附件", "isController": false}, {"data": [[1.53493704E12, 3.0]], "isOverall": false, "label": "确认完成主要部门负责人及简介", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传客户进件资料与合同非标准附件", "isController": false}, {"data": [[1.53493704E12, 17.0]], "isOverall": false, "label": "上传业务门店分布情况标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传近一年每月代偿台账非标准附件", "isController": false}, {"data": [[1.53493704E12, 17.0]], "isOverall": false, "label": "上传客户、经销商、门店准入及筛选标准非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成公司组织架构", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成企业工商信息", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成非标准附件(财务信息)", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线下", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "录入企业基本情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传对外负债情况标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成融资情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "录入商务部初审意见", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司未来发展计划非标准附件", "isController": false}, {"data": [[1.53493698E12, 0.0]], "isOverall": false, "label": "创建资产方", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线上", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "确认完成业务地域分布情况", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "提交审批", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传对外担保情况标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传近三年审计报告、咨询报告非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司股东、高级管理人员简历非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传融资情况标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "提交风控", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传公司章程非标准附件", "isController": false}, {"data": [[1.53493704E12, 0.0]], "isOverall": false, "label": "上传两年一期末级科目余额表非标准附件", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.53493704E12, "title": "Connect Time Over Time"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getConnectTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average Connect Time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendConnectTimeOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average connect time was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesConnectTimeOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotConnectTimeOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewConnectTimeOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Connect Time Over Time
function refreshConnectTimeOverTime(fixTimestamps) {
    var infos = connectTimeOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotConnectTimeOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesConnectTimeOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotConnectTimeOverTime", "#overviewConnectTimeOverTime");
        $('#footerConnectTimeOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var responseTimePercentilesOverTimeInfos = {
        data: {"result": {"minY": 187.0, "minX": 1.53493698E12, "maxY": 478.0, "series": [{"data": [[1.53493698E12, 437.0], [1.53493704E12, 478.0]], "isOverall": false, "label": "Max", "isController": false}, {"data": [[1.53493698E12, 224.0], [1.53493704E12, 187.0]], "isOverall": false, "label": "Min", "isController": false}, {"data": [[1.53493698E12, 437.0], [1.53493704E12, 286.0]], "isOverall": false, "label": "90th percentile", "isController": false}, {"data": [[1.53493698E12, 437.0], [1.53493704E12, 478.0]], "isOverall": false, "label": "99th percentile", "isController": false}, {"data": [[1.53493698E12, 437.0], [1.53493704E12, 364.8000000000002]], "isOverall": false, "label": "95th percentile", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.53493704E12, "title": "Response Time Percentiles Over Time (successful requests only)"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true,
                        fill: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Response Time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimePercentilesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Response time was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimePercentilesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimePercentilesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimePercentilesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Response Time Percentiles Over Time
function refreshResponseTimePercentilesOverTime(fixTimestamps) {
    var infos = responseTimePercentilesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotResponseTimePercentilesOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesResponseTimePercentilesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimePercentilesOverTime", "#overviewResponseTimePercentilesOverTime");
        $('#footerResponseTimePercentilesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var responseTimeVsRequestInfos = {
    data: {"result": {"minY": 248.0, "minX": 0.0, "maxY": 252.0, "series": [{"data": [[0.0, 252.0], [1.0, 248.0]], "isOverall": false, "label": "Successes", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.0, "title": "Response Time Vs Request"}},
    getOptions: function() {
        return {
            series: {
                lines: {
                    show: false
                },
                points: {
                    show: true
                }
            },
            xaxis: {
                axisLabel: "Global number of requests per second",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            yaxis: {
                axisLabel: "Median Response Time in ms",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            legend: {
                noColumns: 2,
                show: true,
                container: '#legendResponseTimeVsRequest'
            },
            selection: {
                mode: 'xy'
            },
            grid: {
                hoverable: true // IMPORTANT! this is needed for tooltip to work
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s : Median response time at %x req/s was %y ms"
            },
            colors: ["#9ACD32", "#FF6347"]
        };
    },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesResponseTimeVsRequest"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotResponseTimeVsRequest"), dataset, options);
        // setup overview
        $.plot($("#overviewResponseTimeVsRequest"), dataset, prepareOverviewOptions(options));

    }
};

// Response Time vs Request
function refreshResponseTimeVsRequest() {
    var infos = responseTimeVsRequestInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimeVsRequest"))){
        infos.create();
    }else{
        var choiceContainer = $("#choicesResponseTimeVsRequest");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimeVsRequest", "#overviewResponseTimeVsRequest");
        $('#footerResponseRimeVsRequest .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var latenciesVsRequestInfos = {
    data: {"result": {"minY": 248.0, "minX": 0.0, "maxY": 251.0, "series": [{"data": [[0.0, 251.0], [1.0, 248.0]], "isOverall": false, "label": "Successes", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.0, "title": "Latencies Vs Request"}},
    getOptions: function() {
        return{
            series: {
                lines: {
                    show: false
                },
                points: {
                    show: true
                }
            },
            xaxis: {
                axisLabel: "Global number of requests per second",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            yaxis: {
                axisLabel: "Median Latency in ms",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            legend: { noColumns: 2,show: true, container: '#legendLatencyVsRequest' },
            selection: {
                mode: 'xy'
            },
            grid: {
                hoverable: true // IMPORTANT! this is needed for tooltip to work
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s : Median response time at %x req/s was %y ms"
            },
            colors: ["#9ACD32", "#FF6347"]
        };
    },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesLatencyVsRequest"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotLatenciesVsRequest"), dataset, options);
        // setup overview
        $.plot($("#overviewLatenciesVsRequest"), dataset, prepareOverviewOptions(options));
    }
};

// Latencies vs Request
function refreshLatenciesVsRequest() {
        var infos = latenciesVsRequestInfos;
        prepareSeries(infos.data);
        if(isGraph($("#flotLatenciesVsRequest"))){
            infos.createGraph();
        }else{
            var choiceContainer = $("#choicesLatencyVsRequest");
            createLegend(choiceContainer, infos);
            infos.createGraph();
            setGraphZoomable("#flotLatenciesVsRequest", "#overviewLatenciesVsRequest");
            $('#footerLatenciesVsRequest .legendColorBox > div').each(function(i){
                $(this).clone().prependTo(choiceContainer.find("li").eq(i));
            });
        }
};

var hitsPerSecondInfos = {
        data: {"result": {"minY": 0.05, "minX": 1.53493698E12, "maxY": 1.2833333333333334, "series": [{"data": [[1.53493698E12, 0.05], [1.53493704E12, 1.2833333333333334]], "isOverall": false, "label": "hitsPerSecond", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.53493704E12, "title": "Hits Per Second"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of hits / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendHitsPerSecond"
                },
                selection: {
                    mode : 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y.2 hits/sec"
                }
            };
        },
        createGraph: function createGraph() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesHitsPerSecond"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotHitsPerSecond"), dataset, options);
            // setup overview
            $.plot($("#overviewHitsPerSecond"), dataset, prepareOverviewOptions(options));
        }
};

// Hits per second
function refreshHitsPerSecond(fixTimestamps) {
    var infos = hitsPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if (isGraph($("#flotHitsPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesHitsPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotHitsPerSecond", "#overviewHitsPerSecond");
        $('#footerHitsPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var codesPerSecondInfos = {
        data: {"result": {"minY": 0.05, "minX": 1.53493698E12, "maxY": 1.2833333333333334, "series": [{"data": [[1.53493698E12, 0.05], [1.53493704E12, 1.2833333333333334]], "isOverall": false, "label": "200", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.53493704E12, "title": "Codes Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of responses / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendCodesPerSecond"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "Number of Response Codes %s at %x was %y.2 responses / sec"
                }
            };
        },
    createGraph: function() {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesCodesPerSecond"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotCodesPerSecond"), dataset, options);
        // setup overview
        $.plot($("#overviewCodesPerSecond"), dataset, prepareOverviewOptions(options));
    }
};

// Codes per second
function refreshCodesPerSecond(fixTimestamps) {
    var infos = codesPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotCodesPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesCodesPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotCodesPerSecond", "#overviewCodesPerSecond");
        $('#footerCodesPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var transactionsPerSecondInfos = {
        data: {"result": {"minY": 0.016666666666666666, "minX": 1.53493698E12, "maxY": 0.016666666666666666, "series": [{"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成主要部门负责人及简介-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成企业工商信息-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成理财部门整体介绍-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传对外担保情况标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传股东情况标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司各月募资情况标准附件线上-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传业务门店分布情况标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传渠道、业务人员返点制度非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "录入尽调信息-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线下-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传关联公司标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成公司组织架构-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成商务部初审意见-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成外部融资渠道最近一年的融资台账-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传业务总量概况标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传产品大纲、盈利逻辑分析及具体收费标准非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传业务地域分布情况标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线上-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成尽调情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传两年一期末级科目余额表非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成股东情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传对外负债情况标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传近三年审计报告、咨询报告非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成非标准附件(业务信息)-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司股东、高级管理人员简历非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "录入企业工商信息-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传外部融资渠道最近一年的融资台账标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传主要部门负责人及简介标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传风控部门设置、风控业务操作流程、制度规定、授信规则非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传产品类别及对应流程图、简介非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传拒单规则、近一年每月的拒单笔数与触碰的规则非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成公司各月募资情况线下-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "提交风控-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司各月募资情况标准附件线下-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成对外负债情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成实际控制人及持股比例-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "状态显示-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "提交审批-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传外部资金方情况标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司募资余额产品结构情况标准附件线上-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成关联公司-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传业务模式、市场定位分析、主营业务竞争优势非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传营业执照非标准附件-success", "isController": false}, {"data": [[1.53493698E12, 0.016666666666666666]], "isOverall": false, "label": "登录-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传近一年有息负债融资清单及相应的协议标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司未来发展计划非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成公司募资余额产品结构情况线下-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传实际控制人、法定代表人身份证、个人征信报告相关信息非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司章程非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成人法、仲裁、失信情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成近一年有息负债融资清单及相应的协议-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "录入商务部初审意见-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成融资情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "录入企业基本情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司简介非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传近一年每月代偿台账非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成业务门店分布情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传人法、仲裁、失信情况标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传融资情况标准附件-success", "isController": false}, {"data": [[1.53493698E12, 0.016666666666666666]], "isOverall": false, "label": "查询资产方ZC0576-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成对外担保情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成业务地域分布情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成非标准附件(风控部门资料)-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传关联方股权结构图非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传公司组织架构标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传股权结构非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传客户、经销商、门店准入及筛选标准非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传Top5资金方协议非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成最近一期公司银行、第三方支付账户列表与余额并提供相应的银行对账单-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成非标准附件(财务信息)-success", "isController": false}, {"data": [[1.53493698E12, 0.016666666666666666]], "isOverall": false, "label": "创建资产方-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "录入实际控制人及持股比例-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成外部资金方情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成公司各月募资情况线上-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传理财部门整体介绍非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成企业基本情况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "确认完成业务总量概况-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传验资报告非标准附件-success", "isController": false}, {"data": [[1.53493704E12, 0.016666666666666666]], "isOverall": false, "label": "上传客户进件资料与合同非标准附件-success", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.53493704E12, "title": "Transactions Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of transactions / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendTransactionsPerSecond"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y transactions / sec"
                }
            };
        },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesTransactionsPerSecond"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotTransactionsPerSecond"), dataset, options);
        // setup overview
        $.plot($("#overviewTransactionsPerSecond"), dataset, prepareOverviewOptions(options));
    }
};

// Transactions per second
function refreshTransactionsPerSecond(fixTimestamps) {
    var infos = transactionsPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotTransactionsPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTransactionsPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTransactionsPerSecond", "#overviewTransactionsPerSecond");
        $('#footerTransactionsPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

// Collapse the graph matching the specified DOM element depending the collapsed
// status
function collapse(elem, collapsed){
    if(collapsed){
        $(elem).parent().find(".fa-chevron-up").removeClass("fa-chevron-up").addClass("fa-chevron-down");
    } else {
        $(elem).parent().find(".fa-chevron-down").removeClass("fa-chevron-down").addClass("fa-chevron-up");
        if (elem.id == "bodyBytesThroughputOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshBytesThroughputOverTime(true);
            }
            document.location.href="#bytesThroughputOverTime";
        } else if (elem.id == "bodyLatenciesOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshLatenciesOverTime(true);
            }
            document.location.href="#latenciesOverTime";
        } else if (elem.id == "bodyConnectTimeOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshConnectTimeOverTime(true);
            }
            document.location.href="#connectTimeOverTime";
        } else if (elem.id == "bodyResponseTimePercentilesOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimePercentilesOverTime(true);
            }
            document.location.href="#responseTimePercentilesOverTime";
        } else if (elem.id == "bodyResponseTimeDistribution") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimeDistribution();
            }
            document.location.href="#responseTimeDistribution" ;
        } else if (elem.id == "bodySyntheticResponseTimeDistribution") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshSyntheticResponseTimeDistribution();
            }
            document.location.href="#syntheticResponseTimeDistribution" ;
        } else if (elem.id == "bodyActiveThreadsOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshActiveThreadsOverTime(true);
            }
            document.location.href="#activeThreadsOverTime";
        } else if (elem.id == "bodyTimeVsThreads") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTimeVsThreads();
            }
            document.location.href="#timeVsThreads" ;
        } else if (elem.id == "bodyCodesPerSecond") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshCodesPerSecond(true);
            }
            document.location.href="#codesPerSecond";
        } else if (elem.id == "bodyTransactionsPerSecond") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTransactionsPerSecond(true);
            }
            document.location.href="#transactionsPerSecond";
        } else if (elem.id == "bodyResponseTimeVsRequest") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimeVsRequest();
            }
            document.location.href="#responseTimeVsRequest";
        } else if (elem.id == "bodyLatenciesVsRequest") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshLatenciesVsRequest();
            }
            document.location.href="#latencyVsRequest";
        }
    }
}

// Collapse
$(function() {
        $('.collapse').on('shown.bs.collapse', function(){
            collapse(this, false);
        }).on('hidden.bs.collapse', function(){
            collapse(this, true);
        });
});

$(function() {
    $(".glyphicon").mousedown( function(event){
        var tmp = $('.in:not(ul)');
        tmp.parent().parent().parent().find(".fa-chevron-up").removeClass("fa-chevron-down").addClass("fa-chevron-down");
        tmp.removeClass("in");
        tmp.addClass("out");
    });
});

/*
 * Activates or deactivates all series of the specified graph (represented by id parameter)
 * depending on checked argument.
 */
function toggleAll(id, checked){
    var placeholder = document.getElementById(id);

    var cases = $(placeholder).find(':checkbox');
    cases.prop('checked', checked);
    $(cases).parent().children().children().toggleClass("legend-disabled", !checked);

    var choiceContainer;
    if ( id == "choicesBytesThroughputOverTime"){
        choiceContainer = $("#choicesBytesThroughputOverTime");
        refreshBytesThroughputOverTime(false);
    } else if(id == "choicesResponseTimesOverTime"){
        choiceContainer = $("#choicesResponseTimesOverTime");
        refreshResponseTimeOverTime(false);
    } else if ( id == "choicesLatenciesOverTime"){
        choiceContainer = $("#choicesLatenciesOverTime");
        refreshLatenciesOverTime(false);
    } else if ( id == "choicesConnectTimeOverTime"){
        choiceContainer = $("#choicesConnectTimeOverTime");
        refreshConnectTimeOverTime(false);
    } else if ( id == "responseTimePercentilesOverTime"){
        choiceContainer = $("#choicesResponseTimePercentilesOverTime");
        refreshResponseTimePercentilesOverTime(false);
    } else if ( id == "choicesResponseTimePercentiles"){
        choiceContainer = $("#choicesResponseTimePercentiles");
        refreshResponseTimePercentiles();
    } else if(id == "choicesActiveThreadsOverTime"){
        choiceContainer = $("#choicesActiveThreadsOverTime");
        refreshActiveThreadsOverTime(false);
    } else if ( id == "choicesTimeVsThreads"){
        choiceContainer = $("#choicesTimeVsThreads");
        refreshTimeVsThreads();
    } else if ( id == "choicesSyntheticResponseTimeDistribution"){
        choiceContainer = $("#choicesSyntheticResponseTimeDistribution");
        refreshSyntheticResponseTimeDistribution();
    } else if ( id == "choicesResponseTimeDistribution"){
        choiceContainer = $("#choicesResponseTimeDistribution");
        refreshResponseTimeDistribution();
    } else if ( id == "choicesHitsPerSecond"){
        choiceContainer = $("#choicesHitsPerSecond");
        refreshHitsPerSecond(false);
    } else if(id == "choicesCodesPerSecond"){
        choiceContainer = $("#choicesCodesPerSecond");
        refreshCodesPerSecond(false);
    } else if ( id == "choicesTransactionsPerSecond"){
        choiceContainer = $("#choicesTransactionsPerSecond");
        refreshTransactionsPerSecond(false);
    } else if ( id == "choicesResponseTimeVsRequest"){
        choiceContainer = $("#choicesResponseTimeVsRequest");
        refreshResponseTimeVsRequest();
    } else if ( id == "choicesLatencyVsRequest"){
        choiceContainer = $("#choicesLatencyVsRequest");
        refreshLatenciesVsRequest();
    }
    var color = checked ? "black" : "#818181";
    choiceContainer.find("label").each(function(){
        this.style.color = color;
    });
}

// Unchecks all boxes for "Hide all samples" functionality
function uncheckAll(id){
    toggleAll(id, false);
}

// Checks all boxes for "Show all samples" functionality
function checkAll(id){
    toggleAll(id, true);
}

// Prepares data to be consumed by plot plugins
function prepareData(series, choiceContainer, customizeSeries){
    var datasets = [];

    // Add only selected series to the data set
    choiceContainer.find("input:checked").each(function (index, item) {
        var key = $(item).attr("name");
        var i = 0;
        var size = series.length;
        while(i < size && series[i].label != key)
            i++;
        if(i < size){
            var currentSeries = series[i];
            datasets.push(currentSeries);
            if(customizeSeries)
                customizeSeries(currentSeries);
        }
    });
    return datasets;
}

/*
 * Ignore case comparator
 */
function sortAlphaCaseless(a,b){
    return a.toLowerCase() > b.toLowerCase() ? 1 : -1;
};

/*
 * Creates a legend in the specified element with graph information
 */
function createLegend(choiceContainer, infos) {
    // Sort series by name
    var keys = [];
    $.each(infos.data.result.series, function(index, series){
        keys.push(series.label);
    });
    keys.sort(sortAlphaCaseless);

    // Create list of series with support of activation/deactivation
    $.each(keys, function(index, key) {
        var id = choiceContainer.attr('id') + index;
        $('<li />')
            .append($('<input id="' + id + '" name="' + key + '" type="checkbox" checked="checked" hidden />'))
            .append($('<label />', { 'text': key , 'for': id }))
            .appendTo(choiceContainer);
    });
    choiceContainer.find("label").click( function(){
        if (this.style.color !== "rgb(129, 129, 129)" ){
            this.style.color="#818181";
        }else {
            this.style.color="black";
        }
        $(this).parent().children().children().toggleClass("legend-disabled");
    });
    choiceContainer.find("label").mousedown( function(event){
        event.preventDefault();
    });
    choiceContainer.find("label").mouseenter(function(){
        this.style.cursor="pointer";
    });

    // Recreate graphe on series activation toggle
    choiceContainer.find("input").click(function(){
        infos.createGraph();
    });
}