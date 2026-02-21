# Extended Markdown Features

## Highlight (Obsidian Extension)

This is ==highlighted text== in a sentence.

Multiple ==highlights== in ==one line==.

==Entire highlighted paragraph.==

## Math — Inline (LaTeX)

The equation $E = mc^2$ is famous.

Pythagorean theorem: $a^2 + b^2 = c^2$

Inline with subscript: $x_1, x_2, \ldots, x_n$

Fraction: $\frac{a}{b}$

## Math — Block (LaTeX)

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix}
$$

## Footnotes

This statement needs a citation[^1].

Another claim requiring evidence[^note].

A third footnote[^3] in the same document.

[^1]: First footnote definition.
[^note]: Named footnote definition with **bold** text.
[^3]: Third footnote with `code` inside.

## YAML Frontmatter

The frontmatter is at the top of the file. This section just verifies frontmatter was parsed.

## Nested Structures

> Blockquote with a list:
>
> - Item A
> - Item B
>   - Nested item
>
> And a code block:
>
> ```python
> print("inside a blockquote")
> ```

- List with blockquote:
  > Quoted inside a list item

- List with code block:
  ```
  code inside list
  ```

1. Ordered list with **bold**, *italic*, and `code`.
2. Second item with a [link](https://www.ciobanu.org/).
3. Third item with ~~strikethrough~~ and ==highlight==.

## Complex Table

| Feature | Syntax | Supported |
| :------ | :----: | --------: |
| Bold | `**text**` | Yes |
| Italic | `*text*` | Yes |
| Strikethrough | `~~text~~` | Yes |
| Highlight | `==text==` | Yes |
| Math | `$E=mc^2$` | Yes |
| Code | `` `code` `` | Yes |

## Mixed Emphasis

This has ***bold italic*** text.

This has **bold with `code` inside**.

This has *italic with **bold** inside*.

This has ~~strikethrough with **bold** inside~~.

## Deep List Nesting

- Level 1
  - Level 2
    - Level 3
      - Level 4
        - Level 5

1. Level 1
   1. Level 2
      1. Level 3
         1. Level 4

## Adjacent Block Elements

# Heading
## Immediately Followed
### By More Headings

---

> Quote

---

```
code
```

---

| A |
|---|
| B |

---

- list

---

## Paragraphs with Inline Diversity

A paragraph with **bold**, *italic*, `code`, ~~strikethrough~~, ==highlight==, [a link](https://www.ciobanu.org/), and math $x^2$ all on one line.

## Empty and Minimal Elements

**

*

``

>

-

1.

## Long Content

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
