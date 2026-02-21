---
title: CommonMark Full Spec Coverage
author: Test Suite
date: 2026-02-19
tags: [test, commonmark, spec]
---

# Heading Level 1

## Heading Level 2

### Heading Level 3

#### Heading Level 4

##### Heading Level 5

###### Heading Level 6

## Paragraphs

This is the first paragraph. It contains multiple sentences.
This sentence is on a new line but part of the same paragraph.

This is the second paragraph, separated by a blank line.

This paragraph has a
hard line break (two trailing spaces).

## Emphasis and Strong

This is *italic with asterisks* and this is _italic with underscores_.

This is **bold with asterisks** and this is __bold with underscores__.

This is ***bold and italic*** combined.

This is **bold with *italic* inside**.

This is *italic with **bold** inside*.

## Inline Code

Use `console.log()` to print output.

Use ``code with `backticks` inside`` for escaping.

This is a sentence with `multiple` inline `code` spans.

## Links

This is an [inline link](https://example.com).

This is an [inline link with title](https://example.com "Example Title").

This is an [empty link]().

An autolink: <https://www.example.com>

An email autolink: <user@example.com>

## Images

![Alt text for image](https://placehold.co/150)

![Image with title](https://placehold.co/300x200 "Placeholder Image")

![](https://placehold.co/50)

## Blockquotes

> This is a blockquote.

> This is a blockquote
> spanning multiple lines.

> First level
>
> > Nested blockquote
>
> Back to first level.

> Blockquote with **bold** and *italic* text.

## Unordered Lists

- Item one
- Item two
- Item three

* Item using asterisk
* Another asterisk item

+ Item using plus
+ Another plus item

- Nested list:
  - Sub-item A
  - Sub-item B
    - Sub-sub-item
  - Sub-item C

## Ordered Lists

1. First item
2. Second item
3. Third item

1. All starting with one
1. Markdown renderers renumber
1. This correctly

1. With nested:
   1. Sub-item one
   2. Sub-item two
      1. Sub-sub-item

## Task Lists

- [ ] Unchecked task
- [x] Checked task
- [ ] Another unchecked task
- [x] Another checked task

Nested tasks:
- [ ] Parent task
  - [ ] Child task one
  - [x] Child task two

## Code Blocks

Indented code block (4 spaces):

    function hello() {
      return "world";
    }

Fenced code block:

```
Plain fenced code block
with multiple lines
```

Fenced with language:

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

```python
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
```

```rust
fn main() {
    println!("Hello, world!");
}
```

```css
.container {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

```json
{
  "name": "marksidian",
  "version": "0.1.0",
  "description": "A markdown editor"
}
```

## Horizontal Rules

---

***

___

## Thematic Breaks Surrounded by Content

Content above the rule.

---

Content below the rule.

## Tables (GFM)

| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

Alignment:

| Left | Center | Right |
| :--- | :----: | ----: |
| L1   |   C1   |    R1 |
| L2   |   C2   |    R2 |

Single column:

| Solo |
| ---- |
| val  |

## Strikethrough (GFM)

This is ~~deleted text~~ in a sentence.

~~Entire paragraph is struck through.~~

## HTML Inline (subset)

This is <em>emphasized via HTML</em> and <strong>bold via HTML</strong>.

A <br> tag for line break.

Keyboard shortcut: <kbd>Ctrl</kbd>+<kbd>C</kbd>

## Escapes

\*Not italic\*

\# Not a heading

\[Not a link\](url)

\> Not a blockquote

Backslash: \\

## Hard Line Breaks

This line ends with two spaces
creating a hard break.

This line ends with a backslash\
also creating a hard break.

## Entity and Numeric References

&copy; &amp; &lt; &gt; &quot;

&#169; &#38; &#60;

## Edge Cases

Empty heading:

#

Heading with trailing hashes:

## Heading ##

List immediately after paragraph:
- Item

> Blockquote immediately after paragraph

Paragraph with no trailing newline at end of file