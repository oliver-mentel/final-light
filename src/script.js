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
    location: document.getElementById("location"),
    timezone: document.getElementById("timezone"),
    selectedDate: document.getElementById("selectedDate"),
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
    currentTheme: localStorage.getItem('theme')
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
    elements.timezone.textContent = state.timezone;
    saveLocationToStorage(suggestion.display_name, suggestion.lat, suggestion.lon, state.timezone);
    elements.location.textContent = suggestion.display_name;
    showAdditionalFields();
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

function calculatePlayTime(holes, flightSize) {
    const baseTime = holes === 9 ? 135 : 255;
    const timeSavingsPerHole = {1: 3, 2: 2, 3: 1};
    const timeSaved = (flightSize < 4) ? timeSavingsPerHole[flightSize] * holes : 0;
    return baseTime - timeSaved;
}

function subtractMinutes(dateStr, minutes) {
    return luxon.DateTime.fromISO(dateStr, {zone: 'UTC'}).minus({minutes}).toISO();
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

        elements.selectedDate.textContent = formatDate(selectedDate);
        elements.sunset.textContent = formatTime(sunData.sunset, use24HourFormat, state.timezone);
        elements.twilightEnd.textContent = formatTime(sunData.civil_twilight_end, use24HourFormat, state.timezone);

        const holes = parseInt(elements.holeCount.value);
        const flightSize = parseInt(elements.flightSize.value);
        const includeTwilight = elements.includeTwilight.checked;

        let playTimeMinutes = calculatePlayTime(holes, flightSize);
        const slowFlightFactor = parseInt(elements.slowFlightDelay.value);

        if (slowFlightFactor !== 0) {
            playTimeMinutes += slowFlightFactor * holes;
        }

        const timePerHole = Math.round(playTimeMinutes / holes);

        elements.timePerHole.textContent = `${timePerHole}min`;
        elements.totalRoundTime.textContent = luxon.Duration.fromObject({minutes: playTimeMinutes}).toFormat('h\'h\' m\'min\'');

        let endTimeStr = includeTwilight ? sunData.civil_twilight_end : sunData.sunset;

        let endTime = luxon.DateTime.fromISO(endTimeStr, {zone: 'UTC'}).setZone(state.timezone);
        let lastTeeTime = endTime.minus({minutes: playTimeMinutes});
        lastTeeTime = lastTeeTime.set({minute: Math.floor(lastTeeTime.minute / 10) * 10, second: 0, millisecond: 0});

        elements.lastTeeTime.textContent = formatTime(lastTeeTime.toISO(), use24HourFormat, state.timezone);

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
        elements.location.textContent = locationData.display_name;
        elements.timezone.textContent = state.timezone;

        elements.locationSearch.value = locationData.display_name;
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
            try {
                await calculateLastTeeTime(true);
            } catch (err) {
                console.error('Error in calculateLastTeeTime:', err);
            }
        } else {
            hideAdditionalFields();
        }
    })();

    elements.clearLocationBtn.addEventListener('click', clearLocation);
    const body = document.body;
    const mainContainer = document.getElementById('mainContainer');

    ["holeCount", "flightSize", "slowFlightDelay"].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => calculateLastTeeTime(true));
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


    elements.timeFormat.addEventListener('change', () => {
        document.getElementById("formatLabel").textContent = elements.timeFormat.checked ? "24H" : "12H";
        updateLastTeeTimeDisplay();
    });
});