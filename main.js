const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const config = require('./config');

const app = express();
const urlencodedParser = bodyParser.urlencoded({ extended: false });
app.use(bodyParser.json());
app.use(cors({credentials: true, origin: 'http://localhost:3000'}));
app.use(cookieParser());

// Some server info
const PORT = 8080;

// Some DB info
const DB_NAME = 'series';
const TABLES = ['users', 'series', 'actors', 'actorsinseries'];

// Some location information
const DB_LOCATION = './public/create_tables.sql';
const ROUTES_DIR = './routes/';

// Status codes
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const INTERNAL_SERVER_ERROR = 500

// Status messages
const INTERNAL_ERROR_MSG = 'Oops, some internal issues occured... Please, try again!';
const UNAUTHORIZED_MSG = 'Please, sign in as administrator first!';

// Logs
const SERVER_LOG = `Server started on port ${PORT}.`;
const CONNECTION_LOG = 'MySql database was connected.';

// Connecting to the DB
// const CONNECTION_STR = 'mysql://root:root@192.168.99.100:3307/series_db?charset=utf8_general_ci&timezone=-0700';
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'series'
});

db.connect((err) => {
    if (err) {
        throw(err);
    }
    console.log(CONNECTION_LOG);
});

// Creating the tables
const sqlFile = fs.readFileSync(DB_LOCATION).toString();
const arrSql = sqlFile.split('\r\n\r\n');
for (let i in arrSql) {
    const query = db.query(arrSql[i], (err, results) => {
        if (err) {
            throw(err);
        }
    });
}

// Customizing the validator
app.use(expressValidator({
    errorFormatter: function(param, msg, value) {
        var namespace = param.split('.')
        , root    = namespace.shift()
        , formParam = root;

    while(namespace.length) {
        formParam += '[' + namespace.shift() + ']';
    }
    return {
        param : formParam,
        msg   : msg,
        value : value
    };
  }
}));

app.use(function (req, res, next) {
    if (req.originalUrl != "/signup" && req.originalUrl != "/signin") {

        let cookieJwt = req.cookies.auth;

        jwt.verify(cookieJwt, config.KEY, function(err, decoded) {
            console.log(err);
            if (err) {
                res.status(UNAUTHORIZED).json({errors: [{ msg: UNAUTHORIZED_MSG }]});
            }
            else {
                next();
            }
        });

    }
    else {
        next();
    }
});

// Some functions for export
function selectAllRows(table, orderBy, callback) {
    const sql = `SELECT * FROM ${table} ${orderBy};`;
    const query = db.query(sql, (err, rows) => {
        if (err) {
            callback(err, INTERNAL_SERVER_ERROR, null);
        }
        else {
            callback(null, OK, rows);
        }
    });
}

function selectAllForIntermediateTable(table, table1ForJoin, table2ForJoin,
    what, tableColumn1, tableColumn2, table1Column, table2Column, callback) {

    const sql = `SELECT ${what} FROM ${table
    } INNER JOIN ${table1ForJoin} ON ${table}.${tableColumn1} = ${table1ForJoin}.${table1Column
    } INNER JOIN ${table2ForJoin} ON ${table}.${tableColumn2} = ${table2ForJoin}.${table2Column
    };`;

    const query = db.query(sql, (err, rows) => {
        if (err) {
            callback(err, INTERNAL_SERVER_ERROR, null);
        }
        else {
            callback(null, OK, rows);
        }
    });

}

function selectRow(table, condition, callback) {
    const sql = `SELECT * FROM ${table} WHERE ${condition};`;
    const query = db.query(sql, (err, row) => {
        if (err) {
            callback(err, INTERNAL_SERVER_ERROR, null);
        }
        else {
            callback(null, OK, row);
        }
    });
}

function selectPartialInfo(table, what, orderBy, callback) {
    const sql = `SELECT ${what} FROM ${table} ${orderBy};`;
    const query = db.query(sql, (err, rows) => {
        if (err) {
            callback(err, INTERNAL_SERVER_ERROR, null);
        }
        else {
            callback(null, OK, rows);
        }
    });
}

function insertRow(table, newValues, callback) {
    const sql = `INSERT INTO ${table} SET ${newValues};`;
    const query = db.query(sql, (err, results) => {
        if (err) {
            callback(err, INTERNAL_SERVER_ERROR);
        }
        else {
            callback(null, CREATED);
        }
    });
}

function deleteRow(table, condition, callback) {
    const sql = `DELETE FROM ${table} WHERE ${condition};`;
    const query = db.query(sql, (err, results) => {
        if (err) {
            callback(err, INTERNAL_SERVER_ERROR);
        }
        else {
            callback(null, NO_CONTENT);
        }
    });
}

function updateRow(table, newValues, condition, callback) {
    const sql = `UPDATE ${table} SET ${newValues} WHERE ${condition};`;
    const query = db.query(sql, (err, results) => {
        if (err) {
            callback(err, INTERNAL_SERVER_ERROR);
        }
        else {
            callback(null, NO_CONTENT);
        }
    });
}

// Indicating global data
global.urlencodedParser = urlencodedParser;
global.db = db;
global.jwt = jwt;
global.expressValidator = expressValidator;

global.selectAllRows = selectAllRows;
global.selectAllForIntermediateTable = selectAllForIntermediateTable;
global.selectRow = selectRow;
global.selectPartialInfo = selectPartialInfo;
global.insertRow = insertRow;
global.deleteRow = deleteRow;
global.updateRow = updateRow;

global.DB_NAME = DB_NAME;

global.OK = OK;
global.CREATED = CREATED;
global.NO_CONTENT = NO_CONTENT;
global.BAD_REQUEST = BAD_REQUEST;
global.UNAUTHORIZED = UNAUTHORIZED;
global.INTERNAL_SERVER_ERROR = INTERNAL_SERVER_ERROR;

global.INTERNAL_ERROR_MSG = INTERNAL_ERROR_MSG;

const signUp = require(`${ROUTES_DIR}signup`);
const signIn = require(`${ROUTES_DIR}signin`);
app.post('/signup', signUp.signUp);
app.post('/signin', signIn.signIn);

let routerTables = [];
for (let i = 0; i < TABLES.length; i++) {
  routerTables.push(require(`${ROUTES_DIR}${TABLES[i]}`));
  app.use(`/${TABLES[i]}`, routerTables[i]);
}

app.get('/', function(req, res) {
    res.sendStatus(NO_CONTENT);
});

// Starting to listen
app.listen(PORT, () => {
    console.log(SERVER_LOG);
});;
