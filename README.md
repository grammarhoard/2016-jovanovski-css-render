# CSS Focusr
A critical path CSS extraction and injection tool using Node.js

## Todo
- [Research] Test whether `<link>` or `<style>` in body, `<script async>` or other variants are faster 
- [BugFix] Deal with crap like `a[href^="javascript:"]:after`
- [BugFix] Deal with crap like `@-ms-viewport`
- [BugFix] Find out why `open` does not work on any other test case than case 1
- [Optimize] Remove overridden properties in generated CSS (ex `width: 0` ... `width: 100%`)
- [Optimize] Remove multiple calls to PhantomJS
- [BugFix]! Take care of relative paths in CSS (ex `background-image` `font-face`)
- ~~[Feature] Create 2 AST's for critical and noncritical CSS~~
- ~~[Feature] Add media rules that don't apply to current viewport in the non-critical CSS~~
- ~~[Feature] Automatically detect and extract CSS file links from given HTML files~~