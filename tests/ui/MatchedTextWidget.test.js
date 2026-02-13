import React from 'react';
import { render } from '@testing-library/react-native';
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

describe('MatchedTextWidget - Layout', () => {
  const mockDocumentData = {
    metadata: {
      title: 'Test Document',
      author: 'Test Author',
    },
    content: [
      {
        type: 'section',
        title: 'Test Section',
        paragraphs: [
          { num: 1, text: 'First paragraph text.' },
          { num: 2, text: 'Second paragraph text.' },
          { num: 3, text: 'Third paragraph text.' },
        ],
      },
    ],
  };

  test('renders all paragraphs with uniform spacing', () => {
    const { getAllByText } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockDocumentData}
        matchedSection="Test Section"
        matchedParagraphNum={2}
        confidence={0.85}
        isLoading={false}
      />
    );

    const paragraphs = getAllByText(/paragraph text/);
    expect(paragraphs).toHaveLength(3);

    // All paragraphs should have same parent container style
    // This will fail initially - implementation needed
  });

  test('highlighted paragraph has background color only (marker-style)', () => {
    const { getByText } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockDocumentData}
        matchedSection="Test Section"
        matchedParagraphNum={2}
        currentParagraphIndex={1}
        firstMatchedParagraphIndex={0}
        confidence={0.85}
        isLoading={false}
      />
    );

    const highlightedPara = getByText('Second paragraph text.');
    const style = highlightedPara.props.style;

    // Should have background color
    expect(style).toEqual(
      expect.objectContaining({
        backgroundColor: expect.any(String),
      })
    );

    // Should NOT have different font size or weight
    expect(style.fontSize).toBeUndefined();
    expect(style.fontWeight).toBeUndefined();
  });

  test('growing highlight spans from first to current paragraph', () => {
    const { getByText, rerender } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockDocumentData}
        matchedSection="Test Section"
        matchedParagraphNum={1}
        currentParagraphIndex={0}
        firstMatchedParagraphIndex={0}
        confidence={0.85}
        isLoading={false}
      />
    );

    // Initially only first paragraph highlighted
    const firstPara = getByText('First paragraph text.');
    expect(firstPara.props.style?.backgroundColor).toBeTruthy();

    // Advance to paragraph 2 - both should be highlighted
    rerender(
      <PaperProvider theme={MD3LightTheme}>
        <MatchedTextWidget
          documentData={mockDocumentData}
          matchedSection="Test Section"
          matchedParagraphNum={2}
          currentParagraphIndex={1}
          firstMatchedParagraphIndex={0}
          confidence={0.85}
          isLoading={false}
        />
      </PaperProvider>
    );

    const secondPara = getByText('Second paragraph text.');
    expect(firstPara.props.style?.backgroundColor).toBeTruthy();
    expect(secondPara.props.style?.backgroundColor).toBeTruthy();
  });
});
