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
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
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

    var data = {"OkPercent": 98.77099148838279, "KoPercent": 1.2290085116172074};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8183402346445825, 2000, 4000, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.8232114101679319, 2000, 4000, "03_Escolher_Voo"], "isController": false}, {"data": [0.822866344605475, 2000, 4000, "02_Buscar_Voos"], "isController": false}, {"data": [0.8048309178743961, 2000, 4000, "01_Home"], "isController": false}, {"data": [0.8224522659305268, 2000, 4000, "04_Finalizar_Compra"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 173880, 2137, 1.2290085116172074, 1758.7010179434176, 220, 12317, 827.0, 3611.9000000000015, 5073.950000000001, 10026.980000000003, 222.74973193937538, 1323.1530854154203, 98.91006443943624], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["03_Escolher_Voo", 43470, 511, 1.1755233494363928, 1688.630595813197, 224, 10800, 737.0, 4238.0, 7688.700000000004, 9918.0, 55.93701906002131, 362.85386913196925, 26.094033648024638], "isController": false}, {"data": ["02_Buscar_Voos", 43470, 557, 1.2813434552564988, 1682.8026455026265, 220, 12317, 732.0, 4302.9000000000015, 7745.0, 9925.970000000005, 55.87403598971722, 396.95981909744535, 23.528986835234576], "isController": false}, {"data": ["01_Home", 43470, 550, 1.2652403956751783, 1968.923027375204, 468, 11129, 1000.0, 4671.800000000003, 8111.0, 10173.970000000005, 55.812197796271995, 256.1419637721445, 16.514742121357827], "isController": false}, {"data": ["04_Finalizar_Compra", 43470, 519, 1.193926846100759, 1694.4478030825976, 223, 12297, 734.0, 4333.0, 7889.950000000001, 9957.990000000002, 55.92169162152322, 312.02185011938195, 33.143066689543915], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["429/Nenhum voo retornado para Paris -&gt; Rome", 16, 0.7487131492746841, 0.009201748332183115], "isController": false}, {"data": ["429/Nenhum voo retornado para Boston -&gt; London", 15, 0.7019185774450164, 0.00862663906142167], "isController": false}, {"data": ["429/Nenhum voo retornado para Boston -&gt; Dublin", 16, 0.7487131492746841, 0.009201748332183115], "isController": false}, {"data": ["429/Nenhum voo retornado para San Diego -&gt; Cairo", 17, 0.7955077211043519, 0.009776857602944559], "isController": false}, {"data": ["429/Nenhum voo retornado para Philadelphia -&gt; New York", 9, 0.42115114646700985, 0.005175983436853002], "isController": false}, {"data": ["429/Nenhum voo retornado para Boston -&gt; Cairo", 14, 0.6551240056153487, 0.008051529790660225], "isController": false}, {"data": ["429/Nenhum voo retornado para Boston -&gt; New York", 16, 0.7487131492746841, 0.009201748332183115], "isController": false}, {"data": ["429/Too Many Requests", 1579, 73.88862891904539, 0.9080975385323211], "isController": false}, {"data": ["429/Nenhum voo retornado para Paris -&gt; Berlin", 19, 0.8890968647636874, 0.01092707614446745], "isController": false}, {"data": ["429/Nenhum voo retornado para Mexico City -&gt; Berlin", 19, 0.8890968647636874, 0.01092707614446745], "isController": false}, {"data": ["429/Nenhum voo retornado para Portland -&gt; Buenos Aires", 10, 0.4679457182966776, 0.005751092707614446], "isController": false}, {"data": ["429/Nenhum voo retornado para San Diego -&gt; New York", 7, 0.32756200280767434, 0.004025764895330112], "isController": false}, {"data": ["429/Nenhum voo retornado para Philadelphia -&gt; Rome", 22, 1.0294805802526907, 0.012652403956751783], "isController": false}, {"data": ["429/Nenhum voo retornado para Philadelphia -&gt; Berlin", 11, 0.5147402901263454, 0.006326201978375892], "isController": false}, {"data": ["429/Nenhum voo retornado para Philadelphia -&gt; London", 15, 0.7019185774450164, 0.00862663906142167], "isController": false}, {"data": ["429/Nenhum voo retornado para Portland -&gt; Rome", 16, 0.7487131492746841, 0.009201748332183115], "isController": false}, {"data": ["429/Nenhum voo retornado para Mexico City -&gt; Cairo", 11, 0.5147402901263454, 0.006326201978375892], "isController": false}, {"data": ["429/Nenhum voo retornado para San Diego -&gt; Berlin", 17, 0.7955077211043519, 0.009776857602944559], "isController": false}, {"data": ["429/Nenhum voo retornado para Mexico City -&gt; Buenos Aires", 14, 0.6551240056153487, 0.008051529790660225], "isController": false}, {"data": ["429/Nenhum voo retornado para Portland -&gt; Berlin", 7, 0.32756200280767434, 0.004025764895330112], "isController": false}, {"data": ["429/Nenhum voo retornado para Mexico City -&gt; London", 15, 0.7019185774450164, 0.00862663906142167], "isController": false}, {"data": ["429/Nenhum voo retornado para San Diego -&gt; Buenos Aires", 9, 0.42115114646700985, 0.005175983436853002], "isController": false}, {"data": ["429/Nenhum voo retornado para Paris -&gt; Buenos Aires", 15, 0.7019185774450164, 0.00862663906142167], "isController": false}, {"data": ["429/Nenhum voo retornado para Boston -&gt; Rome", 16, 0.7487131492746841, 0.009201748332183115], "isController": false}, {"data": ["429/Nenhum voo retornado para San Diego -&gt; Rome", 8, 0.37435657463734207, 0.004600874166091558], "isController": false}, {"data": ["429/Nenhum voo retornado para Boston -&gt; Berlin", 10, 0.4679457182966776, 0.005751092707614446], "isController": false}, {"data": ["429/Nenhum voo retornado para San Diego -&gt; Dublin", 15, 0.7019185774450164, 0.00862663906142167], "isController": false}, {"data": ["429/Nenhum voo retornado para Philadelphia -&gt; Buenos Aires", 12, 0.5615348619560131, 0.006901311249137336], "isController": false}, {"data": ["429/Nenhum voo retornado para Portland -&gt; New York", 13, 0.6083294337856808, 0.00747642051989878], "isController": false}, {"data": ["429/Nenhum voo retornado para Paris -&gt; Dublin", 15, 0.7019185774450164, 0.00862663906142167], "isController": false}, {"data": ["429/Nenhum voo retornado para Mexico City -&gt; New York", 17, 0.7955077211043519, 0.009776857602944559], "isController": false}, {"data": ["429/Nenhum voo retornado para Mexico City -&gt; Rome", 12, 0.5615348619560131, 0.006901311249137336], "isController": false}, {"data": ["429/Nenhum voo retornado para Mexico City -&gt; Dublin", 10, 0.4679457182966776, 0.005751092707614446], "isController": false}, {"data": ["429/Nenhum voo retornado para Portland -&gt; Dublin", 10, 0.4679457182966776, 0.005751092707614446], "isController": false}, {"data": ["429/Nenhum voo retornado para Portland -&gt; London", 15, 0.7019185774450164, 0.00862663906142167], "isController": false}, {"data": ["429/Nenhum voo retornado para Paris -&gt; Cairo", 12, 0.5615348619560131, 0.006901311249137336], "isController": false}, {"data": ["429/Nenhum voo retornado para Philadelphia -&gt; Dublin", 10, 0.4679457182966776, 0.005751092707614446], "isController": false}, {"data": ["500/Internal Server Error", 1, 0.04679457182966776, 5.751092707614447E-4], "isController": false}, {"data": ["429/Nenhum voo retornado para San Diego -&gt; London", 13, 0.6083294337856808, 0.00747642051989878], "isController": false}, {"data": ["429/Nenhum voo retornado para Paris -&gt; New York", 8, 0.37435657463734207, 0.004600874166091558], "isController": false}, {"data": ["429/Nenhum voo retornado para Portland -&gt; Cairo", 14, 0.6551240056153487, 0.008051529790660225], "isController": false}, {"data": ["429/Nenhum voo retornado para Paris -&gt; London", 10, 0.4679457182966776, 0.005751092707614446], "isController": false}, {"data": ["429/Nenhum voo retornado para Boston -&gt; Buenos Aires", 13, 0.6083294337856808, 0.00747642051989878], "isController": false}, {"data": ["429/Nenhum voo retornado para Philadelphia -&gt; Cairo", 14, 0.6551240056153487, 0.008051529790660225], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 173880, 2137, "429/Too Many Requests", 1579, "429/Nenhum voo retornado para Philadelphia -&gt; Rome", 22, "429/Nenhum voo retornado para Paris -&gt; Berlin", 19, "429/Nenhum voo retornado para Mexico City -&gt; Berlin", 19, "429/Nenhum voo retornado para San Diego -&gt; Cairo", 17], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["03_Escolher_Voo", 43470, 511, "429/Too Many Requests", 511, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["02_Buscar_Voos", 43470, 557, "429/Nenhum voo retornado para Philadelphia -&gt; Rome", 22, "429/Nenhum voo retornado para Paris -&gt; Berlin", 19, "429/Nenhum voo retornado para Mexico City -&gt; Berlin", 19, "429/Nenhum voo retornado para San Diego -&gt; Cairo", 17, "429/Nenhum voo retornado para San Diego -&gt; Berlin", 17], "isController": false}, {"data": ["01_Home", 43470, 550, "429/Too Many Requests", 550, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["04_Finalizar_Compra", 43470, 519, "429/Too Many Requests", 518, "500/Internal Server Error", 1, "", "", "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
