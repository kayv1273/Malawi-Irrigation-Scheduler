function generate_report_multi() {
    getZoneData();
    window.location.href = 'report.html';
}

document.addEventListener('DOMContentLoaded', function () {
    const addZoneButton = document.getElementById('addZone');
    
    if (addZoneButton) {
        addZoneButton.addEventListener('click', addZone);
    }
});

let zonesData = []; // Array to store zone data

function getZoneData() {
    const zones = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V'];
    let zoneData = [];

    // Loop through each zone and collect water rate values
    zones.forEach(zone => {
        const inputElement = document.getElementById(`waterRate_${zone}`);
        if (inputElement) {
            const waterRate = parseFloat(inputElement.value) || 0; // Convert to number and handle empty input
            zoneData.push({
                zoneID: zone,
                waterRate: waterRate
            });
        }
    });

    // Get selected date value
    var selectedDate = document.getElementById(`select-date`).value;

    // If no date is selected, default is the current date
    if (!selectedDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        selectedDate = `${year}-${month}-${day}`;
    }    

    // Values for the selected date (will need to set the current date as automatic date)
    const dateParts = selectedDate.split("-");
    const month = dateParts[1];
    const day = dateParts[2];
    const year = dateParts[0];

    // Store date in localStorage and log it
    localStorage.setItem("month", JSON.stringify(month));
    //console.log("Selected month is:", month);
    localStorage.setItem("day", JSON.stringify(day));
    //console.log("Selected day is:", day);
    localStorage.setItem("year", JSON.stringify(year));
    //console.log("Selected year is:", year);

    localStorage.setItem("zoneData", JSON.stringify(zoneData));
    //console.log(zoneData);
}
