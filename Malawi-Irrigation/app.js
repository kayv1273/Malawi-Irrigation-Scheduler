var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

const SunCalc = require("suncalc")
const { google } = require("googleapis")

var app = express();

app.get("/zoneData", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: "credentials.json",
      scopes: "https://www.googleapis.com/auth/spreadsheets"
    });

    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: "v4", auth: client });
    const spreadsheetId = "10blg42bW9OUALTsMCbB445eiVe9DpuE9l7BiN5UO51A";

    const getRows = await googleSheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: "ZoneData",
    });

    res.json(getRows.data);
  } catch (error) {
    res.status(500).send("Error retrieving spreadsheet metadata.");
  }
});

app.get("/solarData", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: "credentials.json",
      scopes: "https://www.googleapis.com/auth/spreadsheets"
    });

    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: "v4", auth: client });
    const spreadsheetId = "10blg42bW9OUALTsMCbB445eiVe9DpuE9l7BiN5UO51A";

    const getRows = await googleSheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: "PumpData",
    });

    res.json(getRows.data);
  } catch (error) {
    res.status(500).send("Error retrieving spreadsheet metadata.");
  }
});

app.get("/sunTime", async (req, res) => {
  try {
    const { lat, lng, date } = req.query;

    if (!lat || !lng || !date) {
      return res.status(400).send("Latitude, longitude, and date are required.");
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const parsedDate = new Date(date);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(parsedDate.getTime())) {
      return res.status(400).send("Invalid latitude, longitude, or date.");
    }

    // Use SunCalc to calculate sunrise and sunset times
    const times = SunCalc.getTimes(parsedDate, latitude, longitude);

    // Send the response back with adjusted times
    res.json(times);
  } catch (error) {
    console.error("Error in /sunrise route:", error);
    res.status(500).send("Error calculating sunrise data.");
  }
});


// Helper function: Convert HH:MM to decimal hours
function timeToDecimal(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
}

// Route to handle the new flow calculation
app.get('/newFlow', (req, res) => {
  try {
      const flow = JSON.parse(req.query.flow); // Parse the flow array
      const sunrise = timeToDecimal(req.query.sunrise); // New sunrise time
      const sunset = timeToDecimal(req.query.sunset); // New sunset time
      const originalSunrise = timeToDecimal(req.query.originalSunrise); // Original sunrise time
      const originalSunset = timeToDecimal(req.query.originalSunset); // Original sunset time

      // Original and new intervals
      const originalInterval = originalSunset - originalSunrise;
      const newInterval = sunset - sunrise;

      // Rescale the data
      const rescaledFlow = flow.map((value, index) => {
          const originalTime = originalSunrise + (index / (flow.length - 1)) * originalInterval;
          const normalizedTime = (originalTime - originalSunrise) / originalInterval;
          const newTime = sunrise + normalizedTime * newInterval;
          return value; // Flow values remain unchanged, only the times are shifted
      });

      // Send the updated flow array back to the client
      res.json(rescaledFlow);
  } catch (error) {
      console.error('Error processing new flow:', error);
      res.status(500).send('Error processing flow data');
  }
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
