# ⛳ Final Light (Tee Time Calculator)

Welcome to the Last Tee Time Calculator! This simple web app helps golfers calculate the last possible tee time for a round of golf based on various parameters including location, number of holes, flight size, and whether to include twilight time.

## Features

- **Location Autocomplete:** Utilize OpenStreetMap's Nominatim API for quick location searches including search suggestions.
- **Sunset and Twilight Calculations:** Fetch sunset and civil twilight data to calculate optimal tee times.
- **User Configuration:** Set number of holes, flight size, and if really ambitious, include twilight time options.
- **Local Storage:** Save location settings for convenience in future sessions.

## Installation

To set up this project locally, follow these steps:

1. **Clone the repository:**

    ```bash
    git clone https://github.com/oliver-mentel/last-tee-time-calculator.git
    cd last-tee-time-calculator
    ```

2. **Open the HTML file:**

   Simply open `index.html` in your web browser to view and use the application.

## Usage

- **Set Location:**
  - Enter city name or golf course location into the search field. Use the auto-suggest feature or press "Enter" to confirm.
  - Utilize the "Set Location" button to fetch location data.

- **Calculate Tee Time:**
  - Set your preferences for number of holes and flight size.
  - Choose to include twilight if desired.
  - Click "Calculate Last Tee Time" to determine the optimal last tee time.

## Technologies Used

- **HTML/CSS:** For structuring and styling the user interface.
- **JavaScript:** Implement logic for fetching data, calculating times, and interacting with the HTML elements.
- **Nominatim API by OpenStreetMap:** Provides location search and suggestions.
- **Sunrise-Sunset API:** Fetches sunset and twilight data based on location coordinates.

## Deployment

This application is published using **GitHub Pages**, making it accessible via a public URL. To view the live application:

1. Ensure your repository is set to deploy via GitHub Pages under the repository settings.
2. Navigate to the URL [https://oliver-mentel.github.io/last-tee-time-calculator](https://oliver-mentel.github.io/last-tee-time-calculator) to see the live site.

## Contributing

Feel free to contribute to this project by opening issues or submitting pull requests on GitHub. Please follow standard practices and add clear descriptions for updates or changes.

## License

This project is open-source and available under the [MIT License](LICENSE).

## Contact

If you have any questions, suggestions, or feedback, feel free to reach out:

- **GitHub:** [@oliver-mentel](https://github.com/oliver-mentel)

---

Thank you for using the Last Tee Time Calculator! We hope this tool helps improve your golf experience.
