# ⛳ Final Light (Tee Time Calculator)

Welcome to Final Light, the ultimate Tee Time Calculator! This web app helps golfers determine the latest possible tee time for a round of golf based on various parameters including location, number of holes, flight size, and optional twilight time inclusion.

## Features

- **Location Autocomplete:** Utilize OpenStreetMap's Nominatim API for quick location searches with search suggestions.
- **Sunset and Twilight Calculations:** Fetch accurate sunset and civil twilight data to calculate optimal tee times.
- **Customizable Settings:** Configure number of holes, flight size, and slow play factors.
- **Twilight Option:** Include twilight time for more flexible scheduling.
- **Time Format Toggle:** Switch between 12-hour and 24-hour time formats.
- **Local Storage:** Save location settings for convenience in future sessions.
- **Responsive Design:** Optimized for both desktop and mobile devices.

## Usage

1. **Set Location:**
   - Enter city name or golf course location into the search field.
   - Select from the auto-suggest options or type a custom location.

2. **Configure Settings:**
   - Choose the date for your golf round.
   - Set the number of holes (9 or 18).
   - Select your flight size (1-4 people).
   - Adjust for slow play factors if needed.
   - Toggle twilight inclusion and time format as desired.

3. **View Results:**
   - See detailed information including sunset time, civil twilight end, and calculated last tee time.
   - Results update automatically as you change settings.

## Technologies Used

- **HTML5/CSS3:** For structuring and styling the responsive user interface.
- **JavaScript (ES6+):** Implements core logic, API interactions, and dynamic UI updates.
- **Nominatim API (OpenStreetMap):** Provides location search and suggestions.
- **Sunrise-Sunset API:** Fetches sunset and twilight data based on location coordinates.
- **TimeZoneDB API:** Determines the correct timezone for accurate time calculations.

## Installation

To set up this project locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/oliver-mentel/final-light.git
   cd final-light
