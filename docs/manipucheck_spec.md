# ManipuCheck - Product Requirements Document (PRD)

## Project Overview

A Chrome extension that helps general news consumers identify manipulative text patterns in web articles through AI-powered analysis. The tool enhances media literacy by highlighting potentially manipulative text blocks and providing educational descriptions of manipulation techniques.

**Target Users**: General news consumers who want to evaluate whether text content deserves trust.

## MVP Scope & Limitations

### In Scope for MVP

- Chrome desktop extension only
- One-article-per-page websites (news articles, blog posts)
- On-demand analysis only
- User-provided LLM API keys
- Basic visual highlighting with tooltips
- Settings page for configuration

### Out of Scope for MVP

- Other browsers (Firefox, Safari, Edge)
- Mobile support
- Social media feeds (except selected text analysis)
- Real-time/automatic analysis
- User onboarding tutorials
- Feedback mechanisms
- Analytics and insights
- Accessibility features
- Multi-device sync
- Server-side infrastructure

## Core User Stories

### Primary Workflows

#### **Story 1: Analyze Full Article**

- User visits a news article page
- User clicks extension icon → popup opens
- User clicks "Analyze This Page" button
- Extension extracts article content and sends to LLM
- Results highlight manipulative text blocks with color coding
- User hovers over highlights to see manipulation descriptions

#### **Story 2: Analyze Selected Text**

- User selects specific text on any webpage (useful for social media posts, comments)
- User clicks extension icon → popup opens
- User clicks "Analyze Selection" button (now enabled)
- Selected text is analyzed and highlighted
- User can see manipulation tooltips on highlighted sections

#### **Story 3: Configure Settings**

- User clicks extension icon → popup opens
- User clicks "Settings" link → settings page opens
- User selects LLM provider (Gemini for MVP)
- User enters API key
- User chooses highlighting mode (full color vs. low contrast)
- User selects analysis language preference

## Feature Specifications

### 1. Extension Popup (320x480px)

**Header Section**

- Extension logo and title
- Current page analysis status indicator

**Action Buttons**

- "Analyze This Page" - Always visible, disabled during processing
- "Analyze Selection" - Only enabled when text is selected
- Working/waiting animation during analysis (not progress bar)

**Results Summary**

- Number of manipulations detected by type
- Last analysis timestamp
- "Clear Results" option

**Footer**

- "Settings" link
- "Help" link (basic usage info)

### 2. Visual Highlighting System

**Highlighting Modes**

- **Full Color Mode**: Distinct colors for each manipulation category
- **Low Contrast Mode**: Subtle highlighting to reduce cognitive load

**Color Coding**

- **Red (#FF6B6B)**: Emotional Manipulation
- **Orange (#FFB347)**: Logical Fallacies  
- **Yellow (#FFD93D)**: Information Distortion
- **Blue (#6BCEFF)**: Persuasion Techniques
- **Purple (#B19CD9)**: Structural Manipulation

**Tooltip Display**

- Appears on hover over highlighted text
- Shows manipulation type and description
- Clean, readable design that doesn't obstruct content
- Maximum width of 300px with word wrapping

### 3. Settings Page

**LLM Configuration**

- Provider selection dropdown (Gemini for MVP)
- LLM model selection dropdown (e.g., gemini-pro, gemini-pro-vision)
- API key input field (masked for security)
- Test connection button
- Security warning about using dedicated API keys with spending limits

**Display Preferences**

- Highlighting mode toggle (Full Color / Low Contrast)
- Language preference for both input processing and output descriptions
- Color customization (future enhancement)

**Privacy & Legal**

- Clear disclaimer about AI analysis reliability
- Data usage explanation
- Link to privacy policy

## Manipulation Type Taxonomy

### Standardized Categories

**1. Emotional Manipulation**
- `fear_mongering`: Using fear to influence opinion
- `outrage_bait`: Content designed to provoke anger
- `emotional_appeal`: Excessive emotional language over facts

**2. Logical Fallacies**
- `strawman`: Misrepresenting opposing arguments
- `ad_hominem`: Attacking person instead of argument
- `false_dichotomy`: Presenting only two options when more exist
- `slippery_slope`: Claiming one event will lead to extreme consequences

**3. Information Distortion**
- `cherry_picking`: Selective use of data/evidence
- `misleading_statistics`: Misuse or misrepresentation of numbers
- `false_correlation`: Implying causation from correlation
- `quote_mining`: Taking quotes out of context

**4. Persuasion Techniques**
- `bandwagon`: Appeal to popularity
- `authority_appeal`: Misuse of expert opinions
- `loaded_language`: Biased or emotionally charged terms
- `repetition`: Excessive repetition for emphasis

**5. Structural Manipulation**
- `headline_mismatch`: Headline doesn't match content
- `buried_lede`: Important information hidden
- `false_balance`: Giving equal weight to unequal positions

## Technical Requirements

### Technical Requirements

- **Frontend**: React with TypeScript
- **Extension Type**: Manifest V3 Chrome extension
- **Data Storage**: Analysis results in-memory only (lost when browser closes)
- **Settings Storage**: Chrome storage.sync for cross-device persistence
- **External Dependencies**: User-provided LLM API keys
- **No Server**: All processing happens client-side

### LLM Integration Requirements

- **MVP Provider**: Google Gemini API
- **Model Selection**: Support multiple Gemini models (gemini-pro, etc.)
- **Multi-language**: Handle both input content and output descriptions in user's preferred language
- **Response Format**: Structured JSON with manipulation blocks
- **Error Handling**: Graceful degradation with manual retry options
- **Rate Limiting**: Respect API limits and show appropriate messages

### Performance Requirements

- **Analysis Response Time**: Show progress indicator for requests >3 seconds
- **Memory Usage**: Minimal impact on browser performance
- **Content Extraction**: Fast and reliable for common news websites

### Security Requirements

- **API Key Storage**: Chrome's built-in storage.sync with basic obfuscation
- **User Warnings**: Clear guidance to use dedicated API keys with spending limits
- **Content Isolation**: No interference from malicious websites
- **Privacy**: No data sent to extension developer's servers
- **Settings Sync**: User preferences sync across browser installations

## User Interface States

### Analysis States per URL

1. **No Data**: Page not analyzed yet
2. **Analysis in Progress**: Loading indicator in popup
3. **Analysis Complete**: Results displayed with highlights
4. **Analysis Error**: Error message with retry option

### Error Handling

- **API Key Missing**: Clear prompt to add key in settings
- **API Error**: Informative error message with manual retry button
- **Content Extraction Failed**: Message explaining compatible websites (prioritizing major news sites)
- **Network Issues**: Offline indicator with manual retry option

## Success Metrics (Post-MVP)

### User Engagement

- Daily active users
- Analysis sessions per user
- Settings page completion rate

### Technical Performance

- Analysis completion rate
- Average response time
- Error frequency by type

### User Satisfaction

- User retention after first use
- Feature usage distribution
- Support ticket volume

## Compliance & Legal

### Required Disclaimers

- "Analysis provided by AI and may not be fully reliable"
- "This tool provides educational information about text patterns"
- "Users should apply critical thinking alongside automated analysis"

### Privacy Considerations

- No user data collection by extension
- API usage subject to chosen provider's terms
- Local storage of preferences only

### Content Policy

- No content filtering or moderation
- Focus on language patterns, not topic judgment
- No fact-checking or truth verification

## Development Phases

### Phase 1: Core Extension (3-4 weeks)

- Basic Chrome extension setup
- React popup interface
- Settings page
- Content extraction system

### Phase 2: LLM Integration (2-3 weeks)

- Gemini API integration
- JSON response parsing
- Error handling
- Progress indicators

### Phase 3: Visual System (2-3 weeks)

- Text highlighting implementation
- Tooltip system
- Color coding
- Highlighting modes

### Phase 4: Polish & Testing (1-2 weeks)

- Cross-website testing
- Performance optimization
- User experience refinement
- Documentation

**Total Estimated Timeline**: 8-12 weeks

## Future Enhancements (Post-MVP)

### High Priority
- User onboarding tutorial
- Feedback mechanism for accuracy improvement
- Additional LLM providers (OpenAI, Anthropic)
- Firefox and Edge support

### Medium Priority
- Advanced analytics and insights
- Export functionality
- Custom manipulation categories
- Improved accessibility

### Low Priority
- Mobile browser support
- Real-time analysis
- Community features
- Integration with fact-checking services

## Risk Mitigation

### Technical Risks
- **Website Compatibility**: Focus on major news sites first
- **LLM API Changes**: Abstract provider interface for easy switching
- **Performance Issues**: Implement caching and optimization

### User Adoption Risks
- **Complex Interface**: Start with simple, intuitive design
- **Setup Friction**: Clear instructions for API key configuration
- **Value Proposition**: Focus on clear, actionable insights

### Operational Risks
- **API Costs**: User pays for their own API usage
- **Support Burden**: Comprehensive documentation and FAQ
- **Legal Issues**: Clear disclaimers and educational positioning

This PRD provides a focused, implementable specification for an MVP that can deliver real value to users while maintaining a manageable scope for development.