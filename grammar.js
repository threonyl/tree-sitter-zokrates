module.exports = grammar({
    name: 'zokrates',

    extras: $ => [
        /\s/,
        $.comment,
    ],

    precedences: $ => [
        [
            'ternary',
            'assign',
            'logical_or',
            'logical_and',
            'bit_or',
            'bit_xor',
            'bit_and',
            'equality',
            'comparison',
            'shift',
            'additive',
            'multiplicative',
            'power',
            'unary',
            'call',
            'member',
        ],
    ],

    word: $ => $.identifier,

    conflicts: $ => [
        [$.struct_expression, $.primary_expression],
        [$.ty_struct, $.primary_expression],
        [$.assignee, $.primary_expression],
        [$.assignee, $.ty_struct],
        [$.assignee, $.ty_struct, $.primary_expression],
        [$.ty_tuple, $.tuple_expression],
    ],

    rules: {
        source_file: $ => seq(
            optional($.pragma),
            repeat($._symbol_declaration)
        ),

        pragma: $ => seq('#pragma', 'curve', $.curve),
        curve: $ => /[a-zA-Z0-9_]+/,

        comment: $ => token(choice(
            seq('//', /.*/),
            seq(
                '/*',
                /[^*]*\*+([^/*][^*]*\*+)*/,
                '/'
            )
        )),

        _symbol_declaration: $ => choice(
            seq(choice($.import_directive, $.const_definition, $.type_definition), ';'),
            $.ty_struct_definition,
            $.function_definition
        ),

        // Imports
        import_directive: $ => choice(
            $.main_import_directive,
            $.from_import_directive
        ),

        main_import_directive: $ => seq(
            'import',
            $.string,
            optional(seq('as', $.identifier))
        ),

        from_import_directive: $ => seq(
            'from',
            $.string,
            'import',
            commaSep1($.import_symbol)
        ),

        import_symbol: $ => seq(
            $.identifier,
            optional(seq('as', $.identifier))
        ),

        // Functions
        function_definition: $ => seq(
            'def',
            field('name', $.identifier),
            optional($.constant_generics_declaration),
            '(',
            optional(field('parameters', $.parameter_list)),
            ')',
            optional(seq('->', field('return_type', $.ty))),
            field('body', $.block_statement)
        ),

        constant_generics_declaration: $ => seq(
            '<',
            commaSep1($.identifier),
            '>'
        ),

        parameter_list: $ => commaSep1($.parameter),

        parameter: $ => seq(
            optional($.visibility),
            field('type', $.ty),
            optional('mut'),
            field('name', $.identifier)
        ),

        visibility: $ => choice('private', 'public'),

        // Types
        ty: $ => choice(
            $.ty_basic,
            $.ty_array,
            $.ty_struct,
            $.ty_tuple
        ),

        ty_basic: $ => choice(
            'field',
            'bool',
            'u8',
            'u16',
            'u32',
            'u64'
        ),

        ty_array: $ => seq(
            choice($.ty_basic, $.ty_struct, $.ty_tuple),
            repeat1(seq('[', $.expression, ']'))
        ),

        ty_tuple: $ => seq(
            '(',
            optional(choice(
                seq($.ty, ','), // Single element tuple must have comma
                seq($.ty, repeat1(seq(',', $.ty)), optional(',')) // Multiple elements
            )),
            ')'
        ),

        ty_struct: $ => seq(
            $.identifier,
            optional($.explicit_generics)
        ),

        // Struct Definition
        ty_struct_definition: $ => seq(
            'struct',
            field('name', $.identifier),
            optional($.constant_generics_declaration),
            '{',
            repeat(seq($.struct_field, ';')),
            '}'
        ),

        struct_field: $ => seq(
            field('type', $.ty),
            field('name', $.identifier)
        ),

        // Constants and Types
        const_definition: $ => seq(
            'const',
            $.ty,
            $.identifier,
            '=',
            $.expression
        ),

        type_definition: $ => seq(
            'type',
            $.identifier,
            optional($.constant_generics_declaration),
            '=',
            $.ty
        ),

        // Statements
        block_statement: $ => seq(
            '{',
            repeat($.statement),
            '}'
        ),

        statement: $ => choice(
            $.iteration_statement,
            $.asm_statement,
            seq(
                choice(
                    $.log_statement,
                    $.return_statement,
                    $.definition_statement,
                    $.assertion_statement,
                    $.expression_statement
                ),
                ';'
            )
        ),

        // Added expression_statement to handle side-effect expressions if allowed, 
        // though Pest grammar implies `definition_statement` covers assignment.
        // Pest `definition_statement` is `typed_identifier_or_assignee ~ "=" ~ expression`.
        // Wait, Pest `statement` doesn't seem to have a bare `expression` statement.
        // But `definition_statement` covers assignments.

        expression_statement: $ => $.expression, // Placeholder if needed, but sticking to Pest strictness first.
        // Actually, looking at Pest: `statement = ... | definition_statement ...`
        // `definition_statement = { typed_identifier_or_assignee ~ "=" ~ expression }`
        // So only assignments are statements? 
        // `return_statement` is there. `log_statement`. `assertion_statement`.
        // It seems bare expressions are NOT statements in ZoKrates (unlike Rust).
        // I will remove `expression_statement` from the choice to match Pest.

        iteration_statement: $ => seq(
            'for',
            $.ty,
            $.identifier,
            'in',
            $.expression,
            '..',
            $.expression,
            $.block_statement
        ),

        log_statement: $ => seq(
            'log',
            '(',
            $.string,
            optional(seq(',', commaSep1($.expression))),
            ')'
        ),

        return_statement: $ => seq(
            'return',
            optional($.expression)
        ),

        definition_statement: $ => seq(
            choice(
                seq($.ty, optional('mut'), $.identifier), // typed_identifier - hard to field this choice without wrapping
                $.assignee
            ),
            '=',
            field('value', $.expression)
        ),

        assignee: $ => seq(
            $.identifier,
            repeat(choice($._subscript_suffix, $._member_suffix))
        ),

        assertion_statement: $ => seq(
            'assert',
            '(',
            $.expression,
            optional(seq(',', $.string)),
            ')'
        ),

        asm_statement: $ => seq(
            'asm',
            '{',
            repeat(seq(
                choice($.asm_assignment, $.asm_constraint),
                ';'
            )),
            '}'
        ),

        asm_assignment: $ => seq(
            $.assignee,
            choice('<--', '<=='),
            $.expression
        ),

        asm_constraint: $ => seq(
            $.expression,
            '===',
            $.expression
        ),

        // Expressions
        expression: $ => choice(
            $.binary_expression,
            $.unary_expression,
            $.ternary_expression,
            $.call_expression,
            $.member_expression,
            $.subscript_expression,
            $.primary_expression
        ),

        binary_expression: $ => {
            const table = [
                ['||', 'logical_or'],
                ['&&', 'logical_and'],
                ['|', 'bit_or'],
                ['^', 'bit_xor'],
                ['&', 'bit_and'],
                ['==', 'equality'],
                ['!=', 'equality'],
                ['<', 'comparison'],
                ['<=', 'comparison'],
                ['>', 'comparison'],
                ['>=', 'comparison'],
                ['<<', 'shift'],
                ['>>', 'shift'],
                ['+', 'additive'],
                ['-', 'additive'],
                ['*', 'multiplicative'],
                ['/', 'multiplicative'],
                ['%', 'multiplicative'],
                ['**', 'power'],
            ];

            return choice(...table.map(([operator, precedence]) => {
                return prec.left(precedence, seq(
                    $.expression,
                    operator,
                    $.expression
                ));
            }));
        },

        unary_expression: $ => prec('unary', seq(
            choice('+', '-', '!'),
            $.expression
        )),

        ternary_expression: $ => prec.right('ternary', seq(
            $.expression,
            '?',
            $.expression,
            ':',
            $.expression
        )),

        // Suffix expressions (Call, Member, Subscript)
        // These bind tighter than binary ops, so we give them high precedence.
        // They are left-associative: a.b.c -> (a.b).c

        call_expression: $ => prec.left('call', seq(
            field('function', $.expression),
            optional(seq('::', $.explicit_generics)),
            '(',
            optional(commaSep1($.expression)),
            ')'
        )),

        member_expression: $ => prec.left('member', seq(
            field('object', $.expression),
            $._member_suffix
        )),

        subscript_expression: $ => prec.left('member', seq(
            field('object', $.expression),
            $._subscript_suffix
        )),

        _member_suffix: $ => seq(
            '.',
            field('property', choice($.identifier, $.decimal_number))
        ),

        _subscript_suffix: $ => seq(
            '[',
            choice(
                field('index', $.expression),
                seq(optional($.expression), '..', optional($.expression)) // Range
            ),
            ']'
        ),

        primary_expression: $ => choice(
            $.identifier,
            $.literal,
            $.tuple_expression,
            $.struct_expression,
            $.array_expression,
            $.array_initializer,
            $.if_expression,
            seq('(', $.expression, ')')
        ),

        if_expression: $ => seq(
            'if',
            $.expression,
            $.block_expression,
            'else',
            $.block_expression
        ),

        block_expression: $ => seq(
            '{',
            repeat($.statement),
            $.expression,
            '}'
        ),

        tuple_expression: $ => seq(
            '(',
            optional(choice(
                seq($.expression, ','),
                seq($.expression, repeat1(seq(',', $.expression)), optional(','))
            )),
            ')'
        ),

        struct_expression: $ => seq(
            field('name', $.identifier),
            '{',
            commaSep(seq(field('field', $.identifier), ':', field('value', $.expression))),
            '}'
        ),

        array_expression: $ => seq(
            '[',
            commaSep(choice($.expression, seq('...', $.expression))),
            ']'
        ),

        array_initializer: $ => seq(
            '[',
            $.expression,
            ';',
            $.expression,
            ']'
        ),

        explicit_generics: $ => seq(
            '<',
            commaSep1(choice($.literal, $.identifier, '_')),
            '>'
        ),

        // Literals
        literal: $ => choice(
            $.decimal_literal,
            $.hex_literal,
            $.boolean_literal,
            $.string
        ),

        decimal_literal: $ => token(seq(
            /[0-9][0-9_]*/,
            optional(choice('u8', 'u16', 'u32', 'u64', 'f'))
        )),

        hex_literal: $ => token(seq(
            '0x',
            /[0-9a-fA-F_]+/
        )),

        boolean_literal: $ => choice('true', 'false'),

        string: $ => seq(
            '"',
            repeat(choice(
                /[^"\\\n]+/,
                /\\./
            )),
            '"'
        ),

        decimal_number: $ => /[0-9]+/,

        identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    }
});

function commaSep(rule) {
    return optional(commaSep1(rule));
}

function commaSep1(rule) {
    return seq(rule, repeat(seq(',', rule)), optional(','));
}
