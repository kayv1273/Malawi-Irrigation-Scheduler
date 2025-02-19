// Print button function
function print_button() {
    window.print();
}

// Back button function
function back_button() {
    window.location.href = 'index.html';
}

var dripRate // Constant drip rate for irrigation system at 15psi (L/h)
var irrigationEfficiency // Estimated irrigation efficiency
var emittersSize // Size of each emitter in cm 

var times = []
var flowSpline

var flowMargin
const occupiedIntervals = []; // Track occupied intervals for irrigation sections

var originalSunrise
var originalSunset

var sunrise
var sunset

var numberOfIntervals = 23;

/* This is a class with constructor that gives the specs of each irrigation section
   based on zoneID values of A-V.
   String zoneID: Sections A-V
   Int emittersStandard: The standard number of emitters based on original constructor
   Float waterVolume: The standard water output (m^3/h)
   Float distanceBetweenDripRows: The standard distance between drip rows (cm)
   Float applicationRatePerHour: The estimated application rate of water each hour (cm/h)
*/
class IrrigationValues {
    constructor(zoneID, numberOfRows, lengthOfDripLine, emittersStandard, waterVolume, distanceBetweenDripRows, applicationRatePerHour) {
        this.zoneID = zoneID
        this.numberOfRows = numberOfRows
        this.lengthOfDripLine = lengthOfDripLine
        this.emittersStandard = emittersStandard
        this.waterVolume = waterVolume
        this.distanceBetweenDripRows = distanceBetweenDripRows
        this.applicationRatePerHour = applicationRatePerHour
    }
}

function setIrrigationValues(data) {
    dripRate = data.values[0][1]
    irrigationEfficiency = data.values[1][1]
    emittersSize = data.values[2][1]
}

// Calculates the number of emitters in a zone based off of the number of drip rows and the length of the drip rows
function calculateEmitters(rows, length) {
    return Math.ceil((length * rows) / (emittersSize / 100)); // Round to the nearest whole number
}

// Calculates the volume of water output (m^3/h) based on drip rate and number of emitters
function calculateVolume(emitters) {
    return ((dripRate * emitters) / 1000);
}

// Calculates the application rate of a drip section
function calculateApplicationRate(distance) {
    return ((dripRate * irrigationEfficiency) / (distance * emittersSize)) * 1000;
}

// Factory function to create IrrigationValues
const createIrrigationValue = ({ zoneID, distanceBetweenDripRows, numberOfRows, lengthOfDripLine }) => {
    const emittersStandard = calculateEmitters(numberOfRows, lengthOfDripLine);
    const waterVolume = calculateVolume(emittersStandard);
    const applicationRatePerHour = calculateApplicationRate(distanceBetweenDripRows);

    return new IrrigationValues(zoneID, numberOfRows, lengthOfDripLine, emittersStandard, waterVolume, distanceBetweenDripRows, applicationRatePerHour);
};

// Function to extract relevant data from the sheet
const extractSectionData = (data) => {
    const sectionData = []
    for (let i = 4; i < data.values.length-3; i = i + 6) {
        const zone = data.values[i][1]; // Zone name
        const distanceBetweenDripRows = data.values[i+1][1]; // Distance values
        const numberOfRows = data.values[i+2][1]; // Rows count
        const lengthOfDripLine = data.values[i+3][1]; // Lengths of drip lines

        const dataObject = {
            zoneID: zone, 
            numberOfRows: numberOfRows, 
            lengthOfDripLine: lengthOfDripLine, 
            distanceBetweenDripRows: distanceBetweenDripRows
        }

        sectionData.push(dataObject)
    }
    return sectionData
};

function setSolarValues(data) {
    efficiency = data.values[0][1]
    waterDensity = data.values[1][1]
    gravAccel = data.values[2][1]
    head = data.values[3][1]
    flowMargin = data.values[4][1]
    originalSunrise = data.values[6][1]
    originalSunset = data.values[7][1]

    const boosterPump = []
    for (let i = 10; i < data.values.length; i++) {
        boosterPump.push(data.values[i][0])
    }
    return getFlow(boosterPump, efficiency, waterDensity, gravAccel, head)
}

function getFlow(boosterPump, efficiency, waterDensity, gravAccel, head) {
    const flowData = []
    for(let i = 0; i < boosterPump.length; i++) {
        flowData[i] = (((boosterPump[i] * 1000) * efficiency) / (waterDensity * gravAccel * head)) * 3600
    }
    return flowData
}

// Custom cubic spline interpolation function
class CubicSpline {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.n = x.length;

        // Calculate second derivatives (curvature) for the spline
        this.secondDerivatives = this.computeSecondDerivatives();
    }

    // Compute the second derivatives using the tri-diagonal matrix algorithm
    computeSecondDerivatives() {
        const n = this.n;
        const x = this.x;
        const y = this.y;
        const u = new Array(n - 1).fill(0);
        const secondDerivatives = new Array(n).fill(0);

        for (let i = 1; i < n - 1; i++) {
            const sig = (x[i] - x[i - 1]) / (x[i + 1] - x[i - 1]);
            const p = sig * secondDerivatives[i - 1] + 2;
            secondDerivatives[i] = (sig - 1) / p;
            u[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i]) - (y[i] - y[i - 1]) / (x[i] - x[i - 1]);
            u[i] = (6 * u[i] / (x[i + 1] - x[i - 1]) - sig * u[i - 1]) / p;
        }
        
        // Will come back to fix this after asking Simon
        // for (let j = n - 2; j >= 0; j--) {
        //     secondDerivatives[j] = secondDerivatives[j] * secondDerivatives[j + 1] + u[j];
        // }
        console.log("Seconds: ", secondDerivatives);

        return secondDerivatives;
    }

    // Evaluate the spline at a given x value
    at(xVal) {
        const x = this.x;
        const y = this.y;
        const secondDerivatives = this.secondDerivatives;
        let klo = 0;
        let khi = this.n - 1;

        // Binary search for the correct interval
        while (khi - klo > 1) {
            const k = Math.floor((khi + klo) / 2);
            if (x[k] > xVal) khi = k;
            else klo = k;
        }

        const h = x[khi] - x[klo];
        if (h === 0) throw new Error("Invalid input: x values must be distinct.");

        const a = (x[khi] - xVal) / h;
        const b = (xVal - x[klo]) / h;
        const yVal = a * y[klo] + b * y[khi] + ((a ** 3 - a) * secondDerivatives[klo] + (b ** 3 - b) * secondDerivatives[khi]) * (h ** 2) / 6;

        return yVal;
    }
}

// Function to get flow rate at a specific time
function getFlowRateAt(time) {
    // console.log("Spline: ", flowSpline);
    // console.log("Time: ", time);
    // console.log("Flow Spline at Time: ", flowSpline.at(time));
    return flowSpline.at(time);
}

// Check if flow is sufficient for a specific interval
function isFlowSufficient(desiredVolume, startTime, endTime) {
    for (let t = startTime; t < endTime; t += 30) { // Every 30 minutes within the range
        if (getFlowRateAt(t) < desiredVolume + flowMargin) {
            return false; // Not enough flow
        }
    }
    return true; // Flow is sufficient for the entire interval
}

// Function to calculate the mean water volume
function calculateMeanWaterVolume(sections) {
    const totalWaterVolume = sections.reduce((sum, section) => sum + section.waterVolume, 0);
    return totalWaterVolume / sections.length;
}

// Split sections into highVolume and lowVolume arrays
function splitVolumes(sections) {
    const meanWaterVolume = calculateMeanWaterVolume(sections);
    
    const highVolume = sections.filter(section => section.waterVolume > meanWaterVolume)
        .map(section => {
            const irrigationValue = createIrrigationValue(section);
            return {
                zoneID: irrigationValue.zoneID,
                waterVolume: irrigationValue.waterVolume,
                applicationRate: irrigationValue.applicationRatePerHour
            };
        });

    const lowVolume = sections.filter(section => section.waterVolume <= meanWaterVolume)
        .map(section => {
            const irrigationValue = createIrrigationValue(section);
            return {
                zoneID: irrigationValue.zoneID,
                waterVolume: irrigationValue.waterVolume,
                applicationRate: irrigationValue.applicationRatePerHour
            };
        });

    return { highVolume, lowVolume };
}

function getMaxTime() {
    return times[times.length-1]
}

// Function to add an irrigation section and check for overlaps
// Function to schedule irrigation
function scheduleIrrigation(volumes, usedIntervals, desiredRates) {
    let schedule = [];

    for (const vol of volumes) {
        let selected = false; // boolean checker to see if a slot was found
        const desiredRateForZone = desiredRates.find(dw => dw.zoneID === vol.zoneID);

        if (!desiredRateForZone || !desiredRateForZone.waterRate) {
            continue; // Skip if there's no desired water rate
        }

        for (let i = times[0]; i < getMaxTime(); i++) {
            const currentFlow = getFlowRateAt(i);

            // if the flow is too close to the current flow (based on a margin that can be changed), we want to keep searching for a new start time
            if ((currentFlow - flowMargin) < vol.waterVolume) {
                continue; // keep checking
            }

            if (currentFlow >= vol.waterVolume) {
                const startTime = i; // starting time in minutes from sunrise
                const totalTime = Math.ceil((desiredRateForZone.waterRate / vol.applicationRate) * 60); // Calculate total time in minutes needed for desired water rate
                const endTime = startTime + totalTime; // Calculate end time in minutes from sunrise

                // console.log("start time calc", startTime)
                // console.log("end time calc", endTime)

                if (isTimeInUsedIntervals(startTime, endTime, usedIntervals)) {
                    continue; // keep checking if the time doesn't fit in the used times
                }

                if (!isFlowSufficient(desiredRateForZone, startTime, endTime)) {
                    continue; // keep checking since the flow is not sufficient throughout the entire time
                }

                // Convert minutes to "HH:MM" format
                const startTimeInHours = timeStringToHoursMinutes(startTime);
                const endTimeInHours = timeStringToHoursMinutes(endTime);

                // console.log("start time", startTimeInHours);

                // Save the used interval
                usedIntervals.push({ start: startTime, end: endTime });

                // Add to the schedule
                schedule.push({
                    zoneID: vol.zoneID,
                    startTime: startTimeInHours,
                    endTime: endTimeInHours,
                    totalTime: totalTime
                });
                selected = true; // slot for zone was found
                break; // Break out of the loop once scheduled
            }
        }
        if (!selected) {
            console.log("Could not find suitable location for zone", vol.zoneID);
        }
    }

    return schedule;
}

// Function to convert minutes since sunrise into "HH:MM" format
function timeStringToHoursMinutes(totalMinutes) {
    // Calculate the hours and minutes
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Format the time to HH:MM
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    return formattedTime;
}

// Function to convert military time string "HH:MM" to decimal hours
function timeStringToHours(stringTimes) {
    // Split the input string into hours and minutes
    const [hoursStr, minutesStr] = stringTimes.split(':');
    
    // Convert the strings to numbers
    const hours = parseInt(hoursStr, 10);    // Convert hours to integer
    const minutes = parseInt(minutesStr, 10); // Convert minutes to integer

    // Calculate decimal hours
    const decimalHours = hours + (minutes / 60);

    return decimalHours; // Return the result
}

// Function to check if a given time overlaps with used intervals
function isTimeInUsedIntervals(startTime, endTime, usedIntervals) {
    for (const interval of usedIntervals) {
        // Check if there is an overlap
        if (startTime <= interval.end && endTime >= interval.start) { // overlaps if startTime is before interval end and endTime is after interval start
            return true; // There is a conflict
        }
    }
    return false; // No conflict found
}

// Main function to run the scheduling
function generateIrrigationSchedule(sections, desiredRates) {
    var usedIntervals = [];
    var highVolumeSchedule = [];
    var lowVolumeSchedule = [];

    // Split sections into highVolume and lowVolume arrays
    const { highVolume, lowVolume } = splitVolumes(sections);

    // Log highVolume and lowVolume arrays
    // console.log("High Volume Sections:", highVolume);
    // console.log("Low Volume Sections:", lowVolume);
    
    // Schedule highVolume first
    if (highVolume.length > 0) {
        highVolumeSchedule = scheduleIrrigation(highVolume, usedIntervals, desiredRates);
    } else {
        console.log("No high volume sections to schedule.");
    }
    
    // Schedule lowVolume next
    if (lowVolume.length > 0) {
        lowVolumeSchedule = scheduleIrrigation(lowVolume, usedIntervals, desiredRates);
    } else {
        console.log("No low volume sections to schedule.");
    }

    // Combine both schedules
    const finalSchedule = [...highVolumeSchedule, ...lowVolumeSchedule];
    
    // Log the final schedule
    console.log("Final Irrigation Schedule:", finalSchedule);
    
    // Save schedule to localStorage
    localStorage.setItem('irrigationSchedule', JSON.stringify(finalSchedule));
    
    return finalSchedule;
}

// Function to populate the table
function populateTable(sections) {
    // Retrieve data from localStorage
    const desiredRates = JSON.parse(localStorage.getItem('zoneData'));

    var irrigationSchedule = generateIrrigationSchedule(sections, desiredRates);
    //console.log(irrigationSchedule);

    // Clean up localStorage
    localStorage.removeItem('zoneData');
    localStorage.removeItem('selectedMonth');
    localStorage.removeItem('selectedDay');
    localStorage.removeItem('selectedYear');

    const tableBody = document.querySelector('.custom-table tbody');

    // Clear any existing rows
    tableBody.innerHTML = '';

    irrigationSchedule = sortTime(irrigationSchedule);

    irrigationSchedule.forEach(zone => {
        // Create a new row
        const row = document.createElement('tr');
        
        // Add Zone ID (section)
        const zoneCell = document.createElement('th');
        zoneCell.scope = 'row';
        zoneCell.textContent = zone.zoneID;
        row.appendChild(zoneCell);
        
        // Add Start Time
        const startTimeCell = document.createElement('td');
        startTimeCell.textContent = zone.startTime;
        row.appendChild(startTimeCell);
        
        // Add End Time
        const endTimeCell = document.createElement('td');
        endTimeCell.textContent = zone.endTime;
        row.appendChild(endTimeCell);
        
        // Append the row to the table body
        tableBody.appendChild(row);
    });
}

function sortTime(arr) {
    if (arr.length <= 1) {
        return arr;
    }

    const pivot = timeStringToHours(arr[Math.floor(arr.length / 2)].startTime);

    // Left and right partitions
    const left = [];
    const right = [];

    // Sorting elements into left and right arrays based on the pivot
    for (let i = 0; i < arr.length; i++) {
        if (i === Math.floor(arr.length / 2)) continue; // skip the pivot
        if (timeStringToHours(arr[i].startTime) < pivot) {
            left.push(arr[i]);
        } else {
            right.push(arr[i]);
        }
    }

    // Recursively sort left and right, then combine them with pivot
    return [...sortTime(left), arr[Math.floor(arr.length / 2)], ...sortTime(right)];
}

async function fetchSpreadsheetData() {
    try {
        const response1 = await fetch("/zoneData");
        const response2 = await fetch("/solarData");
        const zoneData = await response1.json();
        const solarData = await response2.json();
        return {zoneData, solarData}
    } catch (error) {
        console.error("Error fetching data:", error);
        return null
    }
}

async function fetchSunTimes(dateValue) {
    const lat = -13.2543;
    const lng = 34.3015;
    const date = dateValue;
  
    try {
      const response = await fetch(`/sunTime?lat=${lat}&lng=${lng}&date=${date}`);
  
      if (!response.ok) {
        throw new Error(`Error fetching SunCalc data: ${response.statusText}`);
      }
  
      const sunTimes = await response.json();

      return sunTimes;
    } catch (error) {
      console.error("Error fetching sunrise data:", error);
      return null
    }
}

// Function to convert ISO string to time (HH:mm format)
const convertToTime = (isoString) => {
    const timeConversion = 2;
    const date = new Date(isoString); // Create a Date object from the ISO string
    date.setUTCHours(date.getUTCHours() + timeConversion); // Add the offset (e.g., +2 for UTC+2)

    const hours = date.getUTCHours().toString().padStart(2, '0'); // Get hours and format as 2 digits
    const minutes = date.getUTCMinutes().toString().padStart(2, '0'); // Get minutes and format as 2 digits
    return `${hours}:${minutes}`; // Return time in HH:mm format
};

// Renamed function to better reflect its purpose
function calculateIntervalDifferences(sunrise, sunset) {
    // Convert the sunrise and sunset times into minutes (total minutes of the day)
    const sunriseMinutes = timeStringToHours(sunrise) * 60; // Sunrise in minutes
    const sunsetMinutes = timeStringToHours(sunset) * 60; // Sunset in minutes
    
    // Calculate the total minutes difference between sunrise and sunset
    const totalMinutes = sunsetMinutes - sunriseMinutes;
    
    // Calculate the interval difference based on the number of intervals
    const intervalDifference = totalMinutes / numberOfIntervals;
    // console.log("Interval Difference", intervalDifference)
    
    // Generate the array of times (in minutes) for the intervals
    let currentTime = sunriseMinutes;
    times = [];
    for (let i = 0; i < numberOfIntervals; i++) {
        times.push(currentTime);
        currentTime += intervalDifference;
    }
}


// Main function to run everything after fetching the data
async function initializeIrrigationSystem() {
    // Fetch the spreadsheet data
    const data = await fetchSpreadsheetData();

    const selectedMonth = JSON.parse(localStorage.getItem('month'));
    const selectedDay = JSON.parse(localStorage.getItem('day'));
    const selectedYear = JSON.parse(localStorage.getItem('year'));

    const date = new Date(selectedYear, selectedMonth, selectedDay);
    // console.log(date.toISOString()); // Log the date in ISO format

    // Fetch the sun times
    const sunTimes = await fetchSunTimes(date);
    sunrise = convertToTime(sunTimes.sunrise);
    sunset = convertToTime(sunTimes.sunset);
    // console.log("Sunrise:", sunrise);
    // console.log("Sunset:", sunset);

    if (data) {
        // Process the data and create irrigation values
        setIrrigationValues(data.zoneData);
        const sectionData = extractSectionData(data.zoneData);
        const sections = sectionData.map(createIrrigationValue);
        // console.log(sections);

        var flow = setSolarValues(data.solarData);

        // Call the updated function to calculate interval differences
        calculateIntervalDifferences(sunrise, sunset);

        // console.log("Updated times for intervals: ", times);
        
        // Use the times array and flow data to instantiate the cubic spline
        flowSpline = new CubicSpline(times, flow);

        populateTable(sections);
    } else {
        console.error("Failed to fetch the data. Please check the error logs.");
    }
}


// Call the main function to start the process
document.addEventListener('DOMContentLoaded', initializeIrrigationSystem);