/** @type {import('tailwindcss').Config} */
export default {
  // Paths that Tailwind scans for class names to include in the output CSS.
  // Keep this list as narrow as possible: scanning node_modules or large trees
  // causes Tailwind v3's JIT engine to use significantly more RAM and time.
  content: ['src/**/*.ts', 'public/**/*.html'],
  darkMode: 'media',
  theme: {
    extend: {},
  },
  plugins: [],
};
