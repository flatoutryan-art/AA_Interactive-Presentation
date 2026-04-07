'use client';
import React, { createContext, useContext } from 'react';

export const APOLLO_THEME = {
  colors: {
    // Primary brand palette
    charcoal:       '#0D1B14',   // deepest background
    deepForest:     '#0F2318',   // card/section backgrounds
    forest:         '#1A3A28',   // elevated surfaces
    midForest:      '#1E4D30',   // borders, dividers
    green:          '#10B981',   // Apollo Green — primary accent
    mint:           '#34D399',   // secondary accent / highlights
    mintBright:     '#6EE7B7',   // light accent, chart fills
    gold:           '#C9A84C',   // Reunert gold — logo mark
    white:          '#F0FFF4',   // body text
    muted:          '#86EFAC',   // secondary text
    dim:            '#4ADE80',   // tertiary text
    // Semantic
    saving:         '#10B981',
    eskom:          '#EF4444',
    neutral:        '#6B7280',
  },
  fonts: {
    display: "'Barlow Condensed', sans-serif",
    heading: "'Barlow Semi Condensed', sans-serif",
    body:    "'DM Sans', sans-serif",
    mono:    "'JetBrains Mono', monospace",
  },
  spacing: {
    section: '6rem',
    card: '2rem',
  },
};

type Theme = typeof APOLLO_THEME;
const ThemeContext = createContext<Theme>(APOLLO_THEME);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeContext.Provider value={APOLLO_THEME}>
    {children}
  </ThemeContext.Provider>
);

export const useApolloTheme = () => useContext(ThemeContext);
