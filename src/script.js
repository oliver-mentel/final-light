const sunriseSunsetApiBase = "https://api.sunrise-sunset.org/json";
const timeZoneDbApiKey = "B3VY8R50KIYD";

const state = {
    lat: null,
    lng: null,
    timezone: null,
    cachedTimezoneData: null,
    lastUsedDate: '',
    lastUsedLat: '',
    lastUsedLng: '',
    lastSunData: null
};

// DOM element references
const elements = {
    locationSearch: document.getElementById('locationSearch'),
    suggestions: document.getElementById('suggestions'),
    clearLocationBtn: document.getElementById('clearLocationBtn'),
    datePicker: document.getElementById('datePicker'),
    resultContent: document.getElementById('resultContent'),
    resultSkeleton: document.getElementById('resultSkeleton'),
    sunset: document.getElementById("sunset"),
    twilightEnd: document.getElementById("twilightEnd"),
    timePerHole: document.getElementById("timePerHole"),
    totalRoundTime: document.getElementById("totalRoundTime"),
    lastTeeTime: document.getElementById("lastTeeTime"),
    slowFlightNote: document.getElementById("slowFlightNote"),
    timeFormat: document.getElementById("timeFormat"),
    includeTwilight: document.getElementById("includeTwilight"),
    holeCount: document.getElementById("holeCount"),
    flightSize: document.getElementById("flightSize"),
    slowFlightDelay: document.getElementById("slowFlightDelay"),
    toggleSwitch: document.querySelector('.theme-switch input[type="checkbox"]'),
    currentTheme: localStorage.getItem('theme'),
    weekendNote: document.getElementById('weekendNote'),
    walkingNote: document.getElementById('walkingNote'),
    isWalking: document.getElementById('isWalking'),
    courseLength: document.getElementById('courseLength')
};

if (elements.currentTheme) {
    document.documentElement.setAttribute('data-theme', elements.currentTheme);
    if (elements.currentTheme === 'dark') {
        elements.toggleSwitch.checked = true;
    }
}

function switchTheme(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        updateLogo(true);
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        updateLogo(false);
    }
}

function updateLogo(isDarkMode) {
    const logoImage = document.getElementById('logoImage');
    if (isDarkMode) {
        logoImage.src = 'assets/final-light-dark.png';
    } else {
        logoImage.src = 'assets/final-light.png';
    }
}

function showAdditionalFields() {
    document.getElementById('additionalFields').classList.remove('hidden');
}

function hideAdditionalFields() {
    document.getElementById('additionalFields').classList.add('hidden');
}

function setDatePickerToToday() {
    const today = luxon.DateTime.local().toFormat('yyyy-MM-dd');
    elements.datePicker.value = today;
    return today;
}

async function fetchTimeZone(latitude, longitude) {
    try {
        const url = `https://api.timezonedb.com/v2.1/get-time-zone?key=${timeZoneDbApiKey}&format=json&by=position&lat=${latitude}&lng=${longitude}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "OK") {
            state.cachedTimezoneData = data.zoneName;
            return data.zoneName;
        } else {
            throw new Error(data.message || 'Failed to fetch timezone');
        }
    } catch (error) {
        console.warn('Error fetching time zone:', error);
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
}

function formatTime(isoString, use24HourFormat, tzString) {
    const {DateTime} = luxon;
    // Always parse the ISO string explicitly as UTC first
    const dt = DateTime.fromISO(isoString, {zone: 'UTC'});
    // Convert to the target timezone
    const localTime = dt.setZone(tzString);

    // Use Luxon's toFormat method with the correct format strings
    return localTime.toFormat(use24HourFormat ? 'HH:mm' : 'h:mm a');
}

function clearLocation() {
    elements.locationSearch.value = '';
    elements.suggestions.innerHTML = '';
}

async function handleLocationSelection(suggestion) {
    elements.locationSearch.value = suggestion.display_name;
    elements.suggestions.innerHTML = '';
    state.lat = suggestion.lat;
    state.lng = suggestion.lon;
    state.timezone = await fetchTimeZone(state.lat, state.lng);
    if (!state.timezone) {
        state.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.warn('Failed to fetch timezone, using local timezone as fallback.');
    }
    saveLocationToStorage(suggestion.display_name, suggestion.lat, suggestion.lon, state.timezone);
    showAdditionalFields();
    updateHandicapDropdowns();
    await calculateLastTeeTime(true);
}

function formatDate(dateStr) {
    return luxon.DateTime.fromISO(dateStr).toFormat('dd.MM.yyyy');
}

function saveSunDataToStorage(date, sunData) {
    const key = `sunData_${date}_${state.lat}_${state.lng}`;
    localStorage.setItem(key, JSON.stringify(sunData));
}

function loadSunDataFromStorage(date) {
    const key = `sunData_${date}_${state.lat}_${state.lng}`;
    const storedData = localStorage.getItem(key);
    return storedData ? JSON.parse(storedData) : null;
}

async function fetchSunData(date) {
    const cachedData = loadSunDataFromStorage(date);
    if (cachedData) return cachedData;

    try {
        const url = `${sunriseSunsetApiBase}?lat=${state.lat}&lng=${state.lng}&date=${date}&formatted=0`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== "OK") {
            throw new Error('Failed to fetch sun data');
        }

        const sunData = {
            sunset: data.results.sunset.replace('+00:00', 'Z'),
            civil_twilight_end: data.results.civil_twilight_end.replace('+00:00', 'Z')
        };

        saveSunDataToStorage(date, sunData);
        return sunData;
    } catch (error) {
        console.error('Error fetching sun data:', error);
        throw error;
    }
}

function calculatePlayTime(holes, flightSize, isWeekend, isWalking) {
    // Base times: 9 holes = exactly half of 18 holes
    const baseTime = holes === 9
        ? (isWalking ? 90 : 67.5)    // 9 holes: walking/cart
        : (isWalking ? 180 : 135);   // 18 holes: walking/cart

    // Additional time per group size (same logic, half for 9 holes)
    const additionalTimeForFlightSize = holes === 9
        ? {
            1: 0,
            2: 10,    // +10 min for 2nd player
            3: 17.5,  // +17.5 min for 3rd player
            4: 25     // +25 min for 4th player
        }
        : {
            1: 0,
            2: 20,    // +20 min for 2nd player
            3: 35,    // +35 min for 3rd player
            4: 50     // +50 min for 4th player
        };

    // NEW: Count multiple slow players for cumulative effect
    let groupHandicapAdjustment = 0;
    let slowPlayerCount = 0;
    let verySlowPlayerCount = 0;
    let scratchCount = 0;

    for (let i = 1; i <= flightSize; i++) {
        const handicapSelect = document.getElementById(`handicap${i}`);
        if (handicapSelect) {
            const handicapValue = parseInt(handicapSelect.value, 10);
            if (handicapValue === 0) scratchCount++;
            if (handicapValue === 20) slowPlayerCount++;
            if (handicapValue === 30) verySlowPlayerCount++;
        }
    }

// Apply cumulative impact (adjust for 9 vs 18 holes)
    const multiplier = holes === 9 ? 0.5 : 1;

    if (verySlowPlayerCount > 0) {
        groupHandicapAdjustment = (20 + (verySlowPlayerCount - 1) * 5) * multiplier; // Was 30 + 10
    } else if (slowPlayerCount > 0) {
        groupHandicapAdjustment = (15 + (slowPlayerCount - 1) * 5) * multiplier;
    } else if (scratchCount === flightSize) {
        groupHandicapAdjustment = -15 * multiplier;
    }


    const weekendFactor = isWeekend ? 1.1 : 1;

    let totalTime = (baseTime + additionalTimeForFlightSize[flightSize] + groupHandicapAdjustment) * weekendFactor;

    const constraints = holes === 9
        ? {
            1: {min: 60, max: 120},
            2: {min: 75, max: 135},
            3: {min: 90, max: 150},
            4: {min: 105, max: 150}    // Max 2h30 for 9 holes
        }
        : {
            1: {min: 120, max: 240},
            2: {min: 150, max: 270},
            3: {min: 180, max: 300},   // Max 5h for 3 people
            4: {min: 210, max: 270}    // Max 4h30 for 4 people - realistic limit
        };


    const constraint = constraints[flightSize];
    totalTime = Math.max(Math.min(totalTime, constraint.max), constraint.min);

    return Math.round(totalTime);
}


function roundToNext10Minutes(dateStr) {
    const date = luxon.DateTime.fromISO(dateStr, {zone: 'UTC'});
    return date.set({minute: Math.floor(date.minute / 10) * 10, second: 0, millisecond: 0}).toISO();
}

async function calculateLastTeeTime(showLoader = true) {
    if (!state.lat || !state.lng || !state.timezone) {
        alert('Please set a location first.');
        return;
    }

    if (showLoader) {
        elements.resultSkeleton.classList.remove('hidden');
        elements.resultContent.classList.add('hidden');
    }

    try {
        const use24HourFormat = elements.timeFormat.checked;
        let selectedDate = luxon.DateTime.fromISO(elements.datePicker.value || setDatePickerToToday()).toISODate();

        if (selectedDate !== state.lastUsedDate || state.lat !== state.lastUsedLat || state.lng !== state.lastUsedLng) {
            state.lastSunData = await fetchSunData(selectedDate);
            state.lastUsedDate = selectedDate;
            state.lastUsedLat = state.lat;
            state.lastUsedLng = state.lng;
        }

        const sunData = state.lastSunData;

        await new Promise(resolve => setTimeout(resolve, 1500)); // For demonstration/loading effect

        elements.sunset.textContent = formatTime(sunData.sunset, use24HourFormat, state.timezone);
        elements.twilightEnd.textContent = formatTime(sunData.civil_twilight_end, use24HourFormat, state.timezone);

        const holes = parseInt(elements.holeCount.value);
        const flightSize = parseInt(elements.flightSize.value);
        const includeTwilight = elements.includeTwilight.checked;
        const isWeekend = ['Saturday', 'Sunday'].includes(luxon.DateTime.fromISO(selectedDate).toFormat('cccc'));
        const isWalking = elements.isWalking.checked;
        const courseLengthFactor = parseInt(elements.courseLength.value);
        const courseTerrainFactor = parseInt(document.getElementById('courseTerrain').value);

        let playTimeMinutes = calculatePlayTime(holes, flightSize, isWeekend, isWalking);
        const slowFlightFactor = parseInt(elements.slowFlightDelay.value);

        if (slowFlightFactor !== 0) {
            playTimeMinutes += slowFlightFactor * holes;
        }

        if (courseLengthFactor !== 0) {
            playTimeMinutes += courseLengthFactor * holes;
        }

        if (courseTerrainFactor !== 0) {
            playTimeMinutes += courseTerrainFactor * holes;
        }

        const timePerHole = Math.round(playTimeMinutes / holes);

        elements.timePerHole.textContent = `${timePerHole}min`;
        elements.totalRoundTime.textContent = luxon.Duration.fromObject({minutes: playTimeMinutes}).toFormat('h\'h\' m\'min\'');

        // Calculate last tee times for both sunset and twilight
        const sunsetEndTime = luxon.DateTime.fromISO(sunData.sunset, {zone: 'UTC'}).setZone(state.timezone);
        const twilightEndTime = luxon.DateTime.fromISO(sunData.civil_twilight_end, {zone: 'UTC'}).setZone(state.timezone);

        const lastTeeSunset = roundToNext10Minutes(sunsetEndTime.minus({minutes: playTimeMinutes}).toISO());
        const lastTeeTwilight = roundToNext10Minutes(twilightEndTime.minus({minutes: playTimeMinutes}).toISO());

        // Store both times
        state.lastTeeSunset = lastTeeSunset;
        state.lastTeeTwilight = lastTeeTwilight;

        // Display the appropriate time based on the checkbox
        const displayTime = includeTwilight ? lastTeeTwilight : lastTeeSunset;
        elements.lastTeeTime.textContent = formatTime(displayTime, use24HourFormat, state.timezone);

        if (slowFlightFactor > 0) {
            elements.slowFlightNote.textContent = `Note: Added ${slowFlightFactor} minutes per hole due to slow play.`;
            elements.slowFlightNote.classList.remove("hidden");
        } else {
            elements.slowFlightNote.classList.add("hidden");
        }

        // Display weekend factor if applicable
        if (isWeekend) {
            elements.weekendNote.textContent = "Note: Weekend play time adjustment applied.";
            elements.weekendNote.classList.remove("hidden");
        } else {
            elements.weekendNote.classList.add("hidden");
        }

        // Display walking factor if applicable
        if (isWalking) {
            elements.walkingNote.textContent = "Note: Walking time adjustment applied.";
            elements.walkingNote.classList.remove("hidden");
        } else {
            elements.walkingNote.classList.add("hidden");
        }

    } catch (error) {
        console.error('Error calculating last tee time:', error);
        alert('An error occurred while calculating the last tee time. Please make sure a valid date is selected and try again.');
    } finally {
        if (showLoader) {
            elements.resultSkeleton.classList.add('hidden');
            elements.resultContent.classList.remove('hidden');
        }
    }
}

async function updateCourseLengthOptions() {
    const holes = parseInt(elements.holeCount.value);
    const courseLengthSelect = document.getElementById('courseLength');
    const currentValue = courseLengthSelect.value; // Preserve selection if possible

    courseLengthSelect.innerHTML = '';

    let options;

    if (holes === 18) {
        options = [
            {value: "0", text: "Average (5,700-6,200m / 6,200-6,800 yds)"},
            {value: "-1", text: "Short (Under 5,700m / Under 6,200 yds)"},
            {value: "1", text: "Long (6,200-6,600m / 6,800-7,200 yds)"},
            {value: "2", text: "Championship (Over 6,600m / Over 7,200 yds)"}
        ];
    } else { // 9 holes
        options = [
            {value: "0", text: "Average (2,800-3,100m / 3,100-3,400 yds)"},
            {value: "-1", text: "Short (Under 2,800m / Under 3,100 yds)"},
            {value: "1", text: "Long (3,100-3,300m / 3,400-3,600 yds)"},
            {value: "2", text: "Championship (Over 3,300m / Over 3,600 yds)"}
        ];
    }

    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;

        // Preserve previous selection if it exists
        if (opt.value === currentValue) {
            option.selected = true;
        } else if (opt.value === "0" && !currentValue) {
            option.selected = true; // Default to average
        }

        courseLengthSelect.appendChild(option);
    });

    // Recalculate if needed - properly await the promise
    try {
        await calculateLastTeeTime(true);
    } catch (error) {
        console.error('Error calculating last tee time:', error);
    }
}


function updateLastTeeTimeDisplay() {
    const use24HourFormat = elements.timeFormat.checked;
    const includeTwilight = elements.includeTwilight.checked;
    const displayTime = includeTwilight ? state.lastTeeTwilight : state.lastTeeSunset;

    if (displayTime) {
        elements.lastTeeTime.textContent = formatTime(displayTime, use24HourFormat, state.timezone);
    }
}

function handleLocationInput() {
    const query = elements.locationSearch.value.trim();
    if (query.length < 3) {
        elements.suggestions.innerHTML = '';
        elements.suggestions.style.display = 'none';
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`)
        .then(response => response.json())
        .then(displaySuggestions)
        .catch(error => console.error('Error fetching location suggestions:', error));
}

function displaySuggestions(suggestions) {
    elements.suggestions.innerHTML = '';
    if (suggestions.length > 0) {
        suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion.display_name;
            li.addEventListener('click', () => handleLocationSelection(suggestion));
            elements.suggestions.appendChild(li);
        });
        elements.suggestions.style.display = 'block';
    } else {
        elements.suggestions.style.display = 'none';
    }
}

function updateHandicapDropdowns() {
    const flightSize = parseInt(elements.flightSize.value);
    const handicapContainer = document.getElementById('handicapContainer');
    handicapContainer.innerHTML = '';

    for (let i = 1; i <= flightSize; i++) {
        const label = document.createElement('label');
        label.htmlFor = `handicap${i}`;
        label.className = 'label';
        label.textContent = `Player ${i} Handicap:`;

        const select = document.createElement('select');
        select.id = `handicap${i}`;
        select.className = 'handicap-select';

        const options = [
            {value: "0", text: "0-10 (Low)"},
            {value: "10", text: "11-20 (Mid)"},
            {value: "20", text: "21-30 (High)"},
            {value: "30", text: "30+ (Beginner)"}
        ];

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;

            // Set default to Mid handicap (11-20)
            if (opt.value === "10") {
                option.selected = true;
            }

            select.appendChild(option);
        });

        // Add event listener to recalculate on change
        select.addEventListener('change', () => calculateLastTeeTime(true));

        const div = document.createElement('div');
        div.className = 'form-group';
        div.appendChild(label);
        div.appendChild(select);

        handicapContainer.appendChild(div);
    }
}

function saveLocationToStorage(locationName, latitude, longitude, tz) {
    const locationData = {display_name: locationName, lat: latitude, lng: longitude, timezone: tz};
    localStorage.setItem('golfLocation', JSON.stringify(locationData));
}

function loadLocationFromStorage() {
    const storedLocation = localStorage.getItem('golfLocation');
    if (storedLocation) {
        const locationData = JSON.parse(storedLocation);
        state.lat = locationData.lat;
        state.lng = locationData.lng;
        state.timezone = locationData.timezone;
        elements.locationSearch.value = locationData.display_name;
        showAdditionalFields();
        updateHandicapDropdowns()
    } else {
        elements.resultSkeleton.classList.add('hidden');
        elements.resultContent.classList.remove('hidden');
    }
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Event listeners
elements.locationSearch.addEventListener('input', debounce(handleLocationInput, 300));
elements.datePicker.addEventListener('change', calculateLastTeeTime);
elements.toggleSwitch.addEventListener('change', switchTheme, false);
elements.clearLocationBtn.addEventListener('click', clearLocation);
elements.isWalking.addEventListener('change', () => calculateLastTeeTime(true));


function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    elements.toggleSwitch.checked = theme === 'dark';
    updateLogo(theme === 'dark');
}

// Check for saved user preference, if any, on load of the website
const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    applyTheme(currentTheme);
}

const checkbox = document.getElementById('checkbox');
if (checkbox) {
    checkbox.addEventListener('change', function () {
        document.documentElement.classList.toggle('dark', this.checked);
    });
}

document.addEventListener('click', function (e) {
    if (e.target !== elements.locationSearch && e.target !== elements.suggestions) {
        elements.suggestions.innerHTML = '';
        elements.suggestions.style.display = 'none';
    }
});

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    loadLocationFromStorage();

    (async () => {
        if (state.lat && state.lng && state.timezone) {
            showAdditionalFields();
            setDatePickerToToday();
            await updateCourseLengthOptions();
            try {
                await calculateLastTeeTime(true);
            } catch (err) {
                console.error('Error in calculateLastTeeTime:', err);
            }
        } else {
            hideAdditionalFields();
        }
    })();

    document.getElementById('advancedToggle').addEventListener('click', () => {
        const advancedOptions = document.getElementById('advancedOptions');
        const toggleIcon = document.querySelector('.toggle-icon');

        advancedOptions.classList.toggle('hidden');
        toggleIcon.classList.toggle('rotated');
    });

    elements.clearLocationBtn.addEventListener('click', clearLocation);
    const body = document.body;
    const mainContainer = document.getElementById('mainContainer');

    ["holeCount", "slowFlightDelay", "courseLength", "courseTerrain"].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', async () => {
                try {
                    await calculateLastTeeTime(true);
                } catch (error) {
                    console.error('Error calculating last tee time:', error);
                }
            });
        }
    });


    elements.flightSize.addEventListener('change', async () => {
        updateHandicapDropdowns();
        try {
            await calculateLastTeeTime(true);
        } catch (error) {
            console.error('Error calculating last tee time:', error);
        }
    });

    elements.includeTwilight.addEventListener('change', (e) => {
        if (e.target.checked) {
            body.classList.add('twilight-effect');
            mainContainer.classList.add('twilight-effect');
            document.querySelector('.container').classList.add('twilight-effect');
        } else {
            body.classList.remove('twilight-effect');
            mainContainer.classList.remove('twilight-effect');
            document.querySelector('.container').classList.remove('twilight-effect');
        }
        updateLastTeeTimeDisplay();
    });

    // Fix: Make this async to handle the promise from updateCourseLengthOptions
    elements.holeCount.addEventListener('change', async () => {
        try {
            await updateCourseLengthOptions();
        } catch (error) {
            console.error('Error updating course length options:', error);
        }
    });

    elements.timeFormat.addEventListener('change', () => {
        document.getElementById("formatLabel").textContent = elements.timeFormat.checked ? "24H" : "12H";
        updateLastTeeTimeDisplay();
    });
});
