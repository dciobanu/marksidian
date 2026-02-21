# Stress Test Document

## Rapid Structural Transitions

# H1
## H2
### H3
#### H4
##### H5
###### H6
Paragraph immediately after headings.
- List after paragraph
1. Ordered after unordered
> Quote after ordered
```
code after quote
```
---
| A | B |
|---|---|
| 1 | 2 |

Back to paragraph.

## Inline Marker Boundaries

**bold****bold**
*italic**italic*
`code``code`
~~strike~~~~strike~~
==hl====hl==

**bold*italic*bold**

Text**bold**text**bold**text

A*B*C*D*E

## Unclosed Markers

This is **unclosed bold

This is *unclosed italic

This is `unclosed code

This is ~~unclosed strikethrough

This is ==unclosed highlight

## Empty Markers

****

**

``

~~~~

====

## Single Character Content

**a**

*b*

`c`

~~d~~

==e==

## Tables with Edge Cases

| | Empty First Header |
|---|---|
| | empty cell |

| Pipe \| Inside | Normal |
|---|---|
| cell \| pipe | ok |

| A |
|---|
| 1 |
| 2 |
| 3 |
| 4 |
| 5 |

## Links with Special Characters

[Link with (parens)](https://example.com/path_(test))

[Link](https://example.com/search?q=hello&lang=en)

[Link with "quotes"](https://example.com "Title with \"escapes\"")

## Images Inline with Text

Before ![tiny](https://placehold.co/20) after image in paragraph.

![img1](https://placehold.co/50)![img2](https://placehold.co/50)

## Lists with Complex Content

- Item with **bold**, *italic*, and `code`
- Item with a [link](https://example.com)
- Item with math: $x^2 + y^2 = z^2$
- Item with ~~strike~~ and ==highlight==

1. First with `code block`:
   ```
   nested code
   ```
2. Second with blockquote:
   > quoted text
3. Third with task:
   - [ ] Sub-task

## Deeply Nested Blockquotes

> Level 1
> > Level 2
> > > Level 3
> > > > Level 4

## Code Block Languages

```typescript
interface User {
  name: string;
  age: number;
}
```

```sql
SELECT * FROM users WHERE active = true ORDER BY created_at DESC;
```

```html
<div class="container">
  <h1>Title</h1>
  <p>Paragraph</p>
</div>
```

```bash
#!/bin/bash
for i in $(seq 1 10); do
  echo "Line $i"
done
```

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
```

```markdown
# This is markdown inside a code block
**bold** and *italic*
```

## Multiple Math Blocks

Inline: $\alpha$, $\beta$, $\gamma$, $\delta$

$$\alpha + \beta = \gamma$$

$$
\begin{aligned}
a &= b + c \\
d &= e + f
\end{aligned}
$$

## Many Footnotes

Text[^a] and more[^b] and more[^c] and more[^d].

[^a]: Footnote A.
[^b]: Footnote B.
[^c]: Footnote C.
[^d]: Footnote D.

## Large Table

| Col1 | Col2 | Col3 | Col4 | Col5 |
|------|------|------|------|------|
| A1   | A2   | A3   | A4   | A5   |
| B1   | B2   | B3   | B4   | B5   |
| C1   | C2   | C3   | C4   | C5   |
| D1   | D2   | D3   | D4   | D5   |
| E1   | E2   | E3   | E4   | E5   |
| F1   | F2   | F3   | F4   | F5   |

## Task List Variations

- [ ] Task A
- [x] Task B
- [ ] Task C
  - [ ] Subtask C1
  - [x] Subtask C2
  - [ ] Subtask C3
    - [x] Deep subtask

## End of Stress Test
