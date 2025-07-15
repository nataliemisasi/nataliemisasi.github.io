const div = "container";
const button = "button";

function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function () {
  document.getElementById("acl").addEventListener("click", function () {
    document.getElementById(div).innerHTML = "... loading ...";
    document.getElementById(button).innerHTML = "";
    showACL();
  });
  document.getElementById("tables").addEventListener("click", function () {
    document.getElementById(div).innerHTML = "... loading ...";
    document.getElementById(button).innerHTML = "";
    showSchemaTables();
  });

  grist.ready({ requiredAccess: 'none' });
  grist.onRecords(table => {
    // document.getElementById('dump').innerHTML = JSON.stringify(table, null, 2);
  });
  grist.onRecord(record => {

  });
});

//--------------------------------
function showSchemaTables() {
  grist.docApi.fetchTable("_grist_Tables").then(function (tables) {
    grist.docApi.fetchTable("_grist_Tables_column").then(function (data) {

      let result = [];

      function getInitTrigger(deps, ids, labels) {
        if (deps == "") return "";
        let result = [];
        deps.forEach(trigger => {
          let x = ids.indexOf(trigger);
          if (x > 0) {
            result.push(labels[x]);
          }
        });
        return result.join(",");
      }

      for (let i = 0; i < data.id.length; i++) {
        const tableNumber = data.parentId[i];
        const fieldName = data.label[i];
        const fieldType = data.type[i];
        const formula = data.isFormula[i] ? data.formula[i] : "";
        const initFormula = !data.isFormula[i] ? data.formula[i] : "";
        const initTrigger = data.recalcDeps[i] ? data.recalcDeps[i] : "";
        const choices = data.widgetOptions[i] && JSON.parse(data.widgetOptions[i]).choices || [];
        const dropcond = data.widgetOptions[i] && JSON.parse(data.widgetOptions[i]).dropdownCondition || "";

        if (fieldType !== "ManualSortPos" && !fieldName.startsWith("gristHelper")) {
          result.push({
            tableNumber: tableNumber,
            tableName: tables.tableId[tables.id.indexOf(data.parentId[i])],
            fieldName: fieldName,
            fieldType: formula !== "" ? "Formula" : fieldType,
            formula: formula,
            initFormula: initFormula,
            initTrigger: getInitTrigger(initTrigger, data.id, data.label),
            choices: choices,
            dropcond: dropcond ? dropcond.text : ""
          });
        }
      }

      result.sort((a, b) => a.tableNumber - b.tableNumber);

      const tablesGrouped = result.reduce((acc, curr) => {
        if (!acc[curr.tableName]) {
          acc[curr.tableName] = [];
        }
        acc[curr.tableName].push(curr);
        return acc;
      }, {});

      const container = document.getElementById(div);
      container.innerHTML = "Date: " + getTodayDate();
      for (const [tableName, rows] of Object.entries(tablesGrouped)) {
        const tableHtml = `
          <h2>${tableName}</h2>
          <table>
              <thead>
                  <tr>
                      <th>Field</th>
                      <th>Type</th>
                      <th>Formula</th>
                      <th>Choices</th>
                  </tr>
              </thead>
              <tbody>
                  ${rows.map(row => {
          const formulaContent = row.formula ? `<pre>${row.formula}</pre>` : '';
          const initFormulaContent = row.initFormula ? `<span class="title">Field Initialization: </span><pre>${row.initFormula}</pre>` : '';
          const initTriggerContent = row.initTrigger ? `<span class="title">Triggered by changes to columns: </span><pre>${row.initTrigger}</pre>` : '';
          const dropcondContent = row.dropcond ? `<span class="title">Dropdown condition: </span><pre>${row.dropcond}</pre>` : '';
          const formulaText = initFormulaContent || formulaContent;
          const choicesText = row.choices.length > 0 ? row.choices.join('<br>') : '';

          return `
              <tr>
                  <td><b>${row.fieldName}</b></td>
                  <td>${row.fieldType}</td>
                  <td>${formulaText}${initTriggerContent}${dropcondContent}</td>
                  <td>${choicesText}</td>
              </tr>
          `;
        }).join('')}
              </tbody>
          </table>
        `;
        container.innerHTML += tableHtml;
      }

      document.getElementById(button).innerHTML = getButton("downloadBtn", "Save");
      document.getElementById("downloadBtn").addEventListener("click", function () {
        downloadHTML(div, "stylejta", "Tables");
      });
    });
  });
}

/* ---------------------------------------------------------------------------------
 To retrieve the table description: query _grist_Views_section

 _grist_Views_section : { "id": 23, "tableRef": 3, "title": "team", "description": "jta description" }
 _grist_Tables        : { "id": 3, "tableId": "Team", "summarySourceTable": 0, "rawViewSectionRef": 23 }

 description = _grist_Views_section.description[_grist_Views_section.id.indexOf(_grist_Tables.rawViewSectionRef)]
------------------------------------------------------------------------------------*/

//--------------------------------
function showACL() {
  grist.docApi.fetchTable("_grist_ACLResources").then(function (tables) {
    grist.docApi.fetchTable("_grist_ACLRules").then(function (rules) {
      let records = inverseFetch(rules);
      let results = [];
      const TABLEUSER = "_xxx";
      const BR = "<br>";
      for (let i = 0; i < records.length; i++) {
        let r = tables.id.indexOf(records[i].resource);
        let obj = {
          "sortKey": "",
          "table": tables.tableId[r],
          "columns": tables.colIds[r].replace(/,/g, BR),
          "condition": records[i].aclFormula || "All others",
          "ACL": records[i].permissionsText,
          "memo": records[i].memo,
          "attributeName": "",
          "affectedTable": "",
          "affectedField": "",
          "userAttribute": ""
        }
        let userAttributes = records[i].userAttributes;
        if (userAttributes) {
          userAttributes = JSON.parse(userAttributes);
          obj.attributeName = userAttributes.name;
          obj.affectedTable = userAttributes.tableId;
          obj.affectedField = userAttributes.lookupColId;
          obj.userAttribute = userAttributes.charId;
          obj.table = TABLEUSER;
        }
        obj.sortKey = obj.table + obj.columns + records[i].rulePos;
        results.push(obj);
      }

      results.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      function colorizeString(str) {
        let result = str.replace(/([+-])([A-Za-z]+)/g, (match, sign, letters) => {
          if (sign === '+') {
            return `${sign}<span style="color: green;">${letters}</span>`;
          } else if (sign === '-') {
            return `${sign}<span style="color: red;">${letters}</span>`;
          }
        });
        return result;
      }

      function generateUsersTable() {
        let html = `
          <h2>Users</h2>
          <table>
              <thead>
                  <tr>
                      <th>Attribute Name</th>
                      <th>Affected Table</th>
                      <th>Affected Field</th>
                      <th>User Attribute</th>
                  </tr>
            </thead>
            <tbody>`;

        results.forEach(entry => {
          if (entry.table.startsWith('_xxx')) {
            html += `
            <tr>
                <td>${entry.attributeName}</td>
                <td>${entry.affectedTable}</td>
                <td>${entry.affectedField}</td>
                <td>${entry.userAttribute}</td>
            </tr>`;
          }
        });

        html += `</tbody></table>`;
        return html;
      }

      function generateTables() {
        let currentTable = "";
        let html = `
          <h2>Tables</h2>
          <table>
              <thead>
                  <tr>
                      <th>Table</th>
                      <th>Columns</th>
                      <th>Condition</th>
                      <th>ACL</th>
                      <th>Memo</th>
                  </tr>
              </thead>
              <tbody>`;

        results.forEach(entry => {
          if (!entry.table.startsWith('_xxx')) {
            const isNewTable = currentTable !== entry.table && currentTable !== "";
            if (isNewTable) {
              html += `
              <tr>
                  <td class="sep"> </td>
                  <td class="sep"> </td>
                  <td class="sep"> </td>
                  <td class="sep"> </td>
                  <td class="sep"> </td>
              </tr>`;
            }
            html += `
            <tr>
                <td>${isNewTable ? entry.table : ""}</td>
                <td>${entry.columns}</td>
                <td>${entry.condition}</td>
                <td>${colorizeString(entry.ACL)}</td>
                <td>${entry.memo}</td>
            </tr>`;
          }
          currentTable = entry.table;
        });

        html += `</tbody></table>`;
        return html;
      }

      document.getElementById(div).innerHTML = "Date: " + getTodayDate() + generateUsersTable() + generateTables();

      document.getElementById(button).innerHTML = getButton("downloadBtn", "Save");
      document.getElementById("downloadBtn").addEventListener("click", function () {
        downloadHTML(div, "stylejta", "ACL");
      });

    });
  });
}

//--------------------------------
function inverseFetch(records) {
  const keys = Object.keys(records);
  const result = [];
  const length = records[keys[0]].length;
  for (let i = 0; i < length; i++) {
    let obj = {};
    keys.forEach(key => {
      obj[key] = records[key][i];
    });
    result.push(obj);
  }
  return result;
}

//--------------------------------
function getButton(id, text) {
  return `<button id='${id}'>${text}</button>`;
}

//--------------------------------
function getTodayDate(fmt) {
  fmt = fmt ? fmt : "m/d/y";
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  fmt = fmt.replace("d", day).replace("m", month).replace("y", year);
  return fmt;
}

//--------------------------------
function downloadHTML(divHtml, divStyle, fileName) {
  var htmlContent = document.getElementById(divHtml).innerHTML;
  var styleContent = document.getElementById(divStyle).innerHTML;
  var combinedContent = "<html>\n<head>\n<style>\n" + styleContent + "\n</style>\n</head>\n<body>\n\n" + htmlContent + "\n</body>\n</html>";
  var blob = new Blob([combinedContent], { type: 'text/html' });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName + ".html";
  link.click();
}
