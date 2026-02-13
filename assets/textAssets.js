/**
 * Text Assets Mapping
 *
 * React Native doesn't support dynamic requires, so we explicitly
 * require all text files and export them as a mapping.
 *
 * Used on native platforms (iOS/Android) to bundle texts with the app.
 */

const textAssets = {
  'additional-prayers-revealed-bahaullah': require('./texts/additional-prayers-revealed-bahaullah.json'),
  'additional-tablets-extracts-from-tablets-revealed-bahaullah': require('./texts/additional-tablets-extracts-from-tablets-revealed-bahaullah.json'),
  'bahai-sacred-writings': require('./texts/bahai-sacred-writings.json'),
  'call-divine-beloved': require('./texts/call-divine-beloved.json'),
  'days-remembrance': require('./texts/days-remembrance.json'),
  'epistle-son-wolf': require('./texts/epistle-son-wolf.json'),
  'gems-divine-mysteries': require('./texts/gems-divine-mysteries.json'),
  'gleanings-writings-bahaullah': require('./texts/gleanings-writings-bahaullah.json'),
  'hidden-words': require('./texts/hidden-words.json'),
  'kitab-i-aqdas': require('./texts/kitab-i-aqdas.json'),
  'kitab-i-iqan': require('./texts/kitab-i-iqan.json'),
  'prayers-meditations': require('./texts/prayers-meditations.json'),
  'summons-lord-hosts': require('./texts/summons-lord-hosts.json'),
  'tabernacle-unity': require('./texts/tabernacle-unity.json'),
  'tablets-bahaullah': require('./texts/tablets-bahaullah.json'),
};

export default textAssets;
