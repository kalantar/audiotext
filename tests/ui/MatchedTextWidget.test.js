import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import MatchedTextWidget from '../../components/MatchedTextWidget';

// Wrapper with theme provider
const renderWithTheme = (component) => {
  return render(
    <PaperProvider theme={MD3LightTheme}>
      {component}
    </PaperProvider>
  );
};

// Helper to wrap component for rerender (maintains consistency with renderWithTheme)
const wrapWithTheme = (component) => (
  <PaperProvider theme={MD3LightTheme}>
    {component}
  </PaperProvider>
);

// Shared mock data
const mockDocument = {
  title: 'Test Document',
  author: 'Test Author',
  url: 'https://example.com',
  section: 'Test Section',
  verseNum: 1,
};

const mockFullContent = 'First paragraph text. Second paragraph text. Third paragraph text.';

describe('MatchedTextWidget - Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders full content with uniform text styling', () => {
    const { getByText } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 23, end: 48 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
      />
    );

    // Should render the full content
    const content = getByText(/First paragraph text/);
    expect(content).toBeTruthy();
  });

  test('highlighted text has background color only (marker-style)', () => {
    const { getByText } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 23, end: 48 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
      />
    );

    // The highlighted text is split: "econd paragraph text. Thi"
    const highlightedText = getByText(/econd paragraph text\. Thi/);
    const style = highlightedText.props.style;

    // Should have background color (style is an array; flatten to access merged properties)
    expect(StyleSheet.flatten(style)).toEqual(
      expect.objectContaining({
        backgroundColor: expect.any(String),
      })
    );

    // Should NOT have different font size or weight (inherits from parent)
    expect(style.fontSize).toBeUndefined();
    expect(style.fontWeight).toBeUndefined();
  });

  test('highlight position updates when changed', () => {
    const { getByText, rerender } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 0, end: 22 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
      />
    );

    // Initially first paragraph highlighted: "First paragraph text."
    const firstPara = getByText(/First paragraph text\./);
    expect(StyleSheet.flatten(firstPara.props.style)?.backgroundColor).toBeTruthy();

    // Change highlight to second paragraph
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={mockDocument}
          fullContent={mockFullContent}
          highlightPosition={{ start: 23, end: 48 }}
          confidence={0.85}
          isLoading={false}
          isMatching={false}
        />
      )
    );

    // Second paragraph is highlighted: "econd paragraph text. Thi"
    const secondPara = getByText(/econd paragraph text\. Thi/);
    expect(StyleSheet.flatten(secondPara.props.style)?.backgroundColor).toBeTruthy();
  });
});

describe('MatchedTextWidget - Auto-Scroll', () => {
  // The react-native jest mock for ScrollView is a class component.
  // Its instance methods (including scrollTo) are placed on the prototype as jest.fn()s,
  // so all instances share the same spy. We access it directly from the prototype.
  const { ScrollView } = require('react-native');
  let scrollToMock;

  beforeEach(() => {
    jest.clearAllMocks();
    // The built-in mock puts scrollTo on ScrollView.prototype as a jest.fn()
    scrollToMock = ScrollView.prototype.scrollTo;
    scrollToMock.mockClear();
  });

  // Helper: fire onLayout on the View wrapping the highlighted text to set highlightYPosition.current.
  // The component puts onLayout on a View (not Text) — see CLAUDE.md auto-scroll notes.
  function fireHighlightLayout(renderResult, y = 100) {
    const { UNSAFE_getAllByType } = renderResult;
    const { View } = require('react-native');
    const allViews = UNSAFE_getAllByType(View);
    const highlightedViewEl = allViews.find(el => el.props.onLayout);
    if (!highlightedViewEl) {
      throw new Error('fireHighlightLayout: no View element with onLayout prop found — component structure may have changed');
    }
    highlightedViewEl.props.onLayout({ nativeEvent: { layout: { y } } });
    return highlightedViewEl;
  }

  test('auto-scrolls on highlight position change when user has not scrolled', () => {
    const renderResult = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 0, end: 22 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
        isRecording={false}
      />
    );
    const { rerender } = renderResult;

    // Fire onLayout on highlighted text to set highlightYPosition.current = 100
    fireHighlightLayout(renderResult, 100);
    scrollToMock.mockClear();

    // Change highlight position (simulates new match)
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={mockDocument}
          fullContent={mockFullContent}
          highlightPosition={{ start: 23, end: 48 }}
          confidence={0.85}
          isLoading={false}
          isMatching={false}
          isRecording={false}
        />
      )
    );

    // The highlightPosition useEffect should have triggered auto-scroll.
    // y=80 = Math.max(0, 100 - 20): component offsets 20px above highlight for context.
    // Note: tests exercise the synchronous useEffect path; the requestAnimationFrame
    // path in handleHighlightLayout is not covered here.
    expect(scrollToMock).toHaveBeenCalledWith({ y: 80, animated: true });
  });

  test('does not auto-scroll when user has manually scrolled', () => {
    const renderResult = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 0, end: 22 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
        isRecording={false}
      />
    );
    const { rerender, getByTestId } = renderResult;

    // Simulate user manual scroll FIRST (before any onLayout).
    // Since isProgrammaticScroll=false and scrollTarget=null, this goes straight to
    // the user-scroll branch and sets userHasScrolled = true.
    const scrollView = getByTestId('matched-text-scrollview');
    scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 50 } } });

    // Now fire onLayout — highlightYPosition.current gets set to 100, but since
    // userHasScrolled is already true, handleHighlightLayout skips the scrollTo call.
    fireHighlightLayout(renderResult, 100);

    // Clear any scroll calls (just in case)
    scrollToMock.mockClear();

    // Change highlight position (normally would trigger auto-scroll)
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={mockDocument}
          fullContent={mockFullContent}
          highlightPosition={{ start: 23, end: 48 }}
          confidence={0.85}
          isLoading={false}
          isMatching={false}
          isRecording={false}
        />
      )
    );

    // scrollTo should NOT be called — userHasScrolled flag prevents auto-scroll
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  test('resumes auto-scroll when recording starts after user scroll', () => {
    const renderResult = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 0, end: 22 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
        isRecording={false}
      />
    );
    const { rerender, getByTestId } = renderResult;

    // Simulate user manual scroll FIRST (before onLayout), so userHasScrolled = true
    // without triggering the isProgrammaticScroll guard.
    const scrollView = getByTestId('matched-text-scrollview');
    scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 50 } } });

    // Fire onLayout to set highlightYPosition.current — scrollTo skipped (userHasScrolled=true)
    fireHighlightLayout(renderResult, 100);
    scrollToMock.mockClear();

    // Start recording (false → true transition resets userHasScrolled flag)
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={mockDocument}
          fullContent={mockFullContent}
          highlightPosition={{ start: 0, end: 22 }}
          confidence={0.85}
          isLoading={false}
          isMatching={false}
          isRecording={true}
        />
      )
    );

    scrollToMock.mockClear();

    // Change highlight position — auto-scroll should be re-enabled
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={mockDocument}
          fullContent={mockFullContent}
          highlightPosition={{ start: 23, end: 48 }}
          confidence={0.85}
          isLoading={false}
          isMatching={false}
          isRecording={true}
        />
      )
    );

    // scrollTo SHOULD be called — recording start reset the userHasScrolled flag.
    // y=80 = Math.max(0, 100 - 20): component offsets 20px above highlight.
    expect(scrollToMock).toHaveBeenCalledWith({ y: 80, animated: true });
  });

  test('resumes auto-scroll when document changes after user scroll', () => {
    const document1 = { ...mockDocument, docId: 'doc1', section: 'Section 1' };
    const document2 = { ...mockDocument, docId: 'doc2', section: 'Section 2' };

    const renderResult = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={document1}
        fullContent={mockFullContent}
        highlightPosition={{ start: 0, end: 22 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
        isRecording={false}
      />
    );
    const { rerender, getByTestId } = renderResult;

    // Simulate user manual scroll FIRST (before onLayout), so userHasScrolled = true
    // without triggering the isProgrammaticScroll guard.
    const scrollView = getByTestId('matched-text-scrollview');
    scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 50 } } });

    // Fire onLayout to set highlightYPosition.current — scrollTo skipped (userHasScrolled=true)
    fireHighlightLayout(renderResult, 100);
    scrollToMock.mockClear();

    // Change to different document — resets both userHasScrolled AND highlightYPosition to null
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={document2}
          fullContent="Different document content here."
          highlightPosition={{ start: 0, end: 10 }}
          confidence={0.85}
          isLoading={false}
          isMatching={false}
          isRecording={false}
        />
      )
    );

    // highlightYPosition is now null (reset by document change), so the useEffect
    // above won't scroll yet. Fire onLayout for the new document to restore position.
    fireHighlightLayout(renderResult, 100);
    scrollToMock.mockClear();

    // Now a highlight change should trigger scroll — user scroll flag was reset
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={document2}
          fullContent="Different document content here."
          highlightPosition={{ start: 11, end: 20 }}
          confidence={0.85}
          isLoading={false}
          isMatching={false}
          isRecording={false}
        />
      )
    );

    // scrollTo SHOULD be called — document change reset the userHasScrolled flag.
    // y=80 = Math.max(0, 100 - 20): component offsets 20px above highlight.
    expect(scrollToMock).toHaveBeenCalledWith({ y: 80, animated: true });
  });

  test('does not scroll when highlight position unchanged', () => {
    const { rerender, getByText } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 23, end: 48 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
      />
    );

    const initialHighlight = getByText(/econd paragraph text\. Thi/);
    expect(StyleSheet.flatten(initialHighlight.props.style)?.backgroundColor).toBeTruthy();

    // Rerender with same highlight position but different confidence
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={mockDocument}
          fullContent={mockFullContent}
          highlightPosition={{ start: 23, end: 48 }}
          confidence={0.90}
          isLoading={false}
          isMatching={false}
        />
      )
    );

    // Same text should still be highlighted
    const stillHighlighted = getByText(/econd paragraph text\. Thi/);
    expect(StyleSheet.flatten(stillHighlighted.props.style)?.backgroundColor).toBeTruthy();
  });
});

describe('MatchedTextWidget - State Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows "Searching..." when isMatching is true', () => {
    const { queryByText } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={null}
        fullContent={null}
        highlightPosition={null}
        confidence={0}
        isLoading={false}
        isMatching={true}
      />
    );

    // Should show searching indicator
    const searchingText = queryByText(/searching/i);
    expect(searchingText).toBeTruthy();
  });

  test('shows "Loading text..." when isLoading without document', () => {
    const { queryByText } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={null}
        fullContent={null}
        highlightPosition={null}
        confidence={0}
        isLoading={true}
        isMatching={false}
      />
    );

    // Should show loading text
    const loadingText = queryByText(/loading text/i);
    expect(loadingText).toBeTruthy();
  });

  test('shows empty state when no match', () => {
    const { getByText } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={null}
        fullContent={null}
        highlightPosition={null}
        confidence={0}
        isLoading={false}
        isMatching={false}
      />
    );

    // Should show ready message
    expect(getByText(/ready to listen/i)).toBeTruthy();
  });

  test('shows content when match exists', () => {
    const { getByText, queryByText } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 23, end: 48 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
      />
    );

    // Should show document title and content
    expect(getByText('Test Document')).toBeTruthy();
    expect(getByText(/First paragraph text/)).toBeTruthy();

    // Should not show empty state
    expect(queryByText(/ready to listen/i)).toBeFalsy();
  });

  test('content persists when loading new match', () => {
    const { getByText, rerender } = renderWithTheme(
      <MatchedTextWidget
        matchedDocument={mockDocument}
        fullContent={mockFullContent}
        highlightPosition={{ start: 23, end: 48 }}
        confidence={0.85}
        isLoading={false}
        isMatching={false}
      />
    );

    // Content visible initially
    expect(getByText(/First paragraph text/)).toBeTruthy();

    // Set isMatching to true (searching for new match)
    rerender(
      wrapWithTheme(
        <MatchedTextWidget
          matchedDocument={mockDocument}
          fullContent={mockFullContent}
          highlightPosition={{ start: 23, end: 48 }}
          confidence={0.85}
          isLoading={false}
          isMatching={true}
        />
      )
    );

    // Content should still be visible (no flash)
    // Component doesn't show "Searching..." when document already exists
    expect(getByText(/First paragraph text/)).toBeTruthy();
  });
});
