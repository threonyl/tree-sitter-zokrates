# Tree-sitter ZoKrates

This is a [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the [ZoKrates](https://zokrates.github.io/) language.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Tree-sitter CLI](https://github.com/tree-sitter/tree-sitter/tree/master/cli) (`npm install -g tree-sitter-cli`)

### Building

```bash
npm install
tree-sitter generate
```

### Testing

```bash
tree-sitter test
```

### Parsing a file

```bash
tree-sitter parse test.zok
```

## References

- [ZoKrates Documentation](https://zokrates.github.io/)

**This work is not affiliated with the [ZoKrates](https://zokrates.github.io/introduction.html) project.**
