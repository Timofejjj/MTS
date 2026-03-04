const { getSheetsClient, SHEET_HEADERS } = require('../config/googleSheets');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

/**
 * Converts a row array to an object using headers
 */
function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? '';
  });
  return obj;
}

/**
 * Get all rows from a sheet as array of objects
 */
async function getAll(sheetName) {
  const sheets = await getSheetsClient();
  const headers = SHEET_HEADERS[sheetName];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
  });

  const rows = response.data.values || [];
  return rows.map((row) => rowToObject(headers, row));
}

/**
 * Find rows matching a filter function
 */
async function findWhere(sheetName, filterFn) {
  const all = await getAll(sheetName);
  return all.filter(filterFn);
}

/**
 * Find one row matching a filter function
 */
async function findOne(sheetName, filterFn) {
  const all = await getAll(sheetName);
  return all.find(filterFn) || null;
}

/**
 * Find row by id
 */
async function findById(sheetName, id) {
  return findOne(sheetName, (row) => row.id === id);
}

/**
 * Append a new row to a sheet
 */
async function insert(sheetName, data) {
  const sheets = await getSheetsClient();
  const headers = SHEET_HEADERS[sheetName];
  const row = headers.map((h) => data[h] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row],
    },
  });

  return data;
}

/**
 * Update a row by id
 */
async function updateById(sheetName, id, updates) {
  const sheets = await getSheetsClient();
  const headers = SHEET_HEADERS[sheetName];

  // Get all rows to find the row index
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
  });

  const rows = response.data.values || [];
  const idIndex = headers.indexOf('id');
  const rowIndex = rows.findIndex((row) => row[idIndex] === id);

  if (rowIndex === -1) {
    throw new Error(`Row with id "${id}" not found in sheet "${sheetName}"`);
  }

  // Merge existing row data with updates
  const existingData = rowToObject(headers, rows[rowIndex]);
  const updatedData = { ...existingData, ...updates };
  const newRow = headers.map((h) => updatedData[h] ?? '');

  // Sheet row number = rowIndex + 2 (1-based + header row)
  const sheetRow = rowIndex + 2;
  const endCol = String.fromCharCode(65 + headers.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${sheetRow}:${endCol}${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [newRow],
    },
  });

  return updatedData;
}

/**
 * Delete a row by id
 */
async function deleteById(sheetName, id) {
  const sheets = await getSheetsClient();
  const headers = SHEET_HEADERS[sheetName];

  // First get the spreadsheet to find the sheet's sheetId
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheet = spreadsheet.data.sheets.find(
    (s) => s.properties.title === sheetName
  );
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheet.properties.sheetId;

  // Get all rows to find the row index
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
  });

  const rows = response.data.values || [];
  const idIndex = headers.indexOf('id');
  const rowIndex = rows.findIndex((row) => row[idIndex] === id);

  if (rowIndex === -1) {
    throw new Error(`Row with id "${id}" not found in sheet "${sheetName}"`);
  }

  // Sheet row index = rowIndex + 1 (0-based, skip header)
  const startIndex = rowIndex + 1;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex,
              endIndex: startIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}

/**
 * Initialize all sheets with headers if they don't exist
 */
async function initializeSheets() {
  const sheets = await getSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const existingSheets = spreadsheet.data.sheets.map(
    (s) => s.properties.title
  );

  const sheetNames = Object.keys(SHEET_HEADERS);
  const requests = [];

  // Create missing sheets
  for (const sheetName of sheetNames) {
    if (!existingSheets.includes(sheetName)) {
      requests.push({
        addSheet: {
          properties: { title: sheetName },
        },
      });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  // Set headers for each sheet
  for (const sheetName of sheetNames) {
    const headers = SHEET_HEADERS[sheetName];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
  }

  console.log('✅ Google Sheets initialized successfully');
}

module.exports = {
  getAll,
  findWhere,
  findOne,
  findById,
  insert,
  updateById,
  deleteById,
  initializeSheets,
};
