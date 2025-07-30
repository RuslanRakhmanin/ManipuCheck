# ManipuCheck

A browser extension that uses AI to identify manipulative text patterns in web content.

## Features

- **Real-time Analysis**: Analyze web pages or selected text for manipulative patterns
- **AI-Powered Detection**: Uses Google Gemini AI to identify various manipulation techniques
- **Visual Highlighting**: Highlights detected manipulations with color-coded categories
- **Comprehensive Categories**: Detects emotional manipulation, logical fallacies, information distortion, and more
- **Privacy-Focused**: All processing happens locally or directly with AI providers - no data collection

## Manipulation Categories

### Emotional Manipulation
- Fear mongering
- Outrage bait
- Emotional appeals

### Logical Fallacies
- Strawman arguments
- Ad hominem attacks
- False dichotomies
- Slippery slope arguments

### Information Distortion
- Cherry picking
- Misleading statistics
- False correlations
- Quote mining

### Persuasion Techniques
- Bandwagon effects
- Authority appeals
- Loaded language
- Repetition

### Structural Manipulation
- Headline mismatches
- Buried leads
- False balance

## Installation

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/manipucheck.git
   cd manipucheck
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build:dev
   ```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

### Configuration

1. Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Open the extension options page
3. Enter your API key and configure your preferences

## Usage

### Analyze Entire Page
- Click the extension icon in the toolbar
- Click "Analyze Page" to scan the entire webpage

### Analyze Selected Text
- Select any text on a webpage
- Right-click and choose "Analyze selected text for manipulation"
- Or use the "Analyze Selection" button in the popup

### View Results
- Manipulative text will be highlighted on the page
- Hover over highlights to see detailed explanations
- View summary statistics in the extension popup

## Development

### Project Structure

```
src/
├── background/          # Service worker for API calls
├── content/            # Content scripts for page interaction
│   ├── content-script.ts
│   ├── text-highlighter.ts
│   ├── text-matcher.ts
│   ├── tooltip-manager.ts
│   └── content-extractor.ts
├── popup/              # Extension popup interface
├── options/            # Settings page
├── shared/             # Shared utilities and types
└── assets/             # Icons and static assets
```

### Build Commands

- `npm run build:dev` - Development build
- `npm run build` - Production build
- `npm run watch` - Watch mode for development
- `npm run clean` - Clean build directory

### Key Technologies

- **TypeScript** - Type-safe JavaScript
- **Webpack** - Module bundling
- **Chrome Extensions API** - Browser integration
- **Google Gemini API** - AI-powered text analysis

## Privacy & Security

- **No Data Collection**: We don't collect or store any of your browsing data
- **Local Storage**: Settings and API keys are stored locally in your browser
- **Direct API Communication**: Text analysis requests go directly to Google's servers
- **Secure Storage**: API keys are obfuscated (though not encrypted - for production use, implement proper encryption)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is designed to help identify potentially manipulative text patterns. It should not be considered a definitive judgment of content quality or truthfulness. Always use critical thinking and multiple sources when evaluating information.

## Support

If you encounter issues or have questions:

1. Check the [Issues](https://github.com/your-username/manipucheck/issues) page
2. Create a new issue with detailed information
3. Include browser version, extension version, and steps to reproduce

## Roadmap

- [ ] Support for additional AI providers (OpenAI, Anthropic)
- [ ] Batch analysis for multiple pages
- [ ] Export analysis reports
- [ ] Custom manipulation pattern definitions
- [ ] Integration with fact-checking services
- [ ] Mobile browser support