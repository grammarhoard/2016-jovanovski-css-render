# CSS Focusr
A critical path CSS extraction and injection tool

## Todo
- ~~Remove critical rules from CSS Ast and convert it back to a string~~
- Test whether `<link>` or `<style>` in body, `<script async>` or other variants are faster 
- Deal with crap like `a[href^="javascript:"]:after`
- Remove overridden properties in generated CSS (ex `width: 0` ... `width: 100%`)
- Remove multiple calls to PhantomJS
- ##Take care of relative paths in CSS
- ~~Add media rules that don't apply to current viewport~~
- ~~Automatically detect and extract CSS from HTML files~~