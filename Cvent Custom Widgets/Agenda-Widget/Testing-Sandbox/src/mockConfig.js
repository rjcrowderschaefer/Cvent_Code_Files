export const initialConfig = {
  sort: 'dateTimeAsc',
  maxResults: 100,
  groupByDay: true,
  showDescription: false,
  gutterBg: '#e8eef9',
  cardBg: '#ffffff',

  // NEW: modal color controls
  modalColors: {
    headerBg: '#ffffff',
    dividerColor: '#eeeeee',
    contentBg: '#ffffff'
  },

  typography: {
    // Day header
    eventDate:          { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },

    // Session card (right content)
    sessionName:        { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    sessionTime:        { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    sessionDescription: { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },

    // Session speakers (on the card)
    speakerName:        { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    speakerTitle:       { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    speakerCompany:     { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },

    // Modal controls
    modalName:              { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined }, // top header
    modalSpeakerName:       { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined }, // body name
    modalSpeakerTitle:      { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    modalSpeakerCompany:    { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    modalSpeakerBio:        { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    modalSessionsHeader:    { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    modalSessionName:       { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
    modalSessionDateTime:   { fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined }
  }
};
