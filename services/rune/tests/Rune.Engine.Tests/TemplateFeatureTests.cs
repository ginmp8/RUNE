using System.Text.Json;
using Rune.Application;
using Rune.Core;

namespace Rune.Engine.Tests;

public sealed class TemplateFeatureTests
{
    [Fact]
    public void Expands_variables_conditions_and_bounded_arrays_deterministically()
    {
        const string template = "# {{customer.name}}\n{{#if active}}Active{{/if}}\n{{#each items}}- {{@index}}: {{this.name}} = {{this.amount}}\n{{/each}}";
        using var data = JsonDocument.Parse("""{"customer":{"name":"Acme *Corp*"},"active":true,"items":[{"name":"A","amount":10},{"name":"B","amount":20}]}""");
        var options = new RuneTemplateOptions(ContentType: TemplateContentType.Markdown);
        var first = RuneTemplateEngine.Expand(template, data.RootElement, options);
        var second = RuneTemplateEngine.Expand(template, data.RootElement, options);
        Assert.Contains("Acme \\*Corp\\*", first.Content);
        Assert.Contains("Active", first.Content);
        Assert.Contains("- 0: A = 10", first.Content);
        Assert.Contains("- 1: B = 20", first.Content);
        Assert.Equal(first.ExpandedSha256, second.ExpandedSha256);
        Assert.True(first.EvaluationSteps > 0);
    }

    [Fact]
    public void Html_values_are_escaped_and_missing_values_fail_by_default()
    {
        using var data = JsonDocument.Parse("""{"value":"<script>alert(1)</script>"}""");
        var result = RuneTemplateEngine.Expand("<p>{{value}}</p>", data.RootElement,
            new RuneTemplateOptions(ContentType: TemplateContentType.Html));
        Assert.Contains("&lt;script&gt;", result.Content);
        Assert.DoesNotContain("<script>", result.Content, StringComparison.OrdinalIgnoreCase);
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.Expand("{{missing}}", data.RootElement, new RuneTemplateOptions()));
    }

    [Fact]
    public void Validates_required_properties_and_types_before_expansion()
    {
        using var data = JsonDocument.Parse("""{"name":"RUNE","count":3}""");
        using var schema = JsonDocument.Parse("""{"type":"object","required":["name","count"],"properties":{"name":{"type":"string"},"count":{"type":"integer"}}}""");
        RuneTemplateEngine.ValidateSchema(data.RootElement, schema.RootElement);
        using var invalid = JsonDocument.Parse("""{"name":"RUNE"}""");
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.ValidateSchema(invalid.RootElement, schema.RootElement));
    }

    [Fact]
    public void Rejects_raw_interpolation_partials_and_excessive_iterations()
    {
        using var data = JsonDocument.Parse("""{"items":[1,2,3]}""");
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.Expand("{{{value}}}", data.RootElement, new RuneTemplateOptions()));
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.Expand("{{> partial}}", data.RootElement, new RuneTemplateOptions()));
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.Expand("{{#each items}}{{this}}{{/each}}", data.RootElement,
            new RuneTemplateOptions(MaximumIterations: 2)));
    }

    [Fact]
    public void Expands_partials_raw_values_allowlisted_helpers_and_regional_formats()
    {
        using var data = JsonDocument.Parse("""{"name":"  Acme  ","amount":1234.5,"when":"2026-07-27T00:00:00Z","raw":{"$runeTrustedHtml":"<em>trusted</em>"}}""");
        var resources = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["partials/header.html"] = "<header>{{upper name}}</header>"
        };
        var options = new RuneTemplateOptions(
            ContentType: TemplateContentType.Html,
            AllowRawInterpolation: true,
            AllowedHelpers: ["upper", "trim", "currency", "date"],
            Culture: "pt-BR");
        var result = RuneTemplateEngine.Expand(
            "{{> header}}<p>{{trim name}}</p><p>{{currency amount \"BRL\"}}</p><time>{{date when \"dd/MM/yyyy\"}}</time>{{{raw}}}",
            data.RootElement, options, resources);
        Assert.Contains("<header>  ACME  </header>", result.Content);
        Assert.Contains("<p>Acme</p>", result.Content);
        Assert.Contains("BRL 1.234,50", result.Content);
        Assert.Contains("27/07/2026", result.Content);
        Assert.Contains("<em>trusted</em>", result.Content);
    }

    [Fact]
    public void Applies_schema_defaults_rejects_additional_properties_and_formats_dates_in_the_configured_time_zone()
    {
        using var data = JsonDocument.Parse("""{"when":"2026-07-28T01:30:00Z"}""");
        using var schema = JsonDocument.Parse("""{"type":"object","additionalProperties":false,"properties":{"when":{"type":"string","format":"date-time"},"label":{"type":"string","default":"generated"}}}""");
        var options = new RuneTemplateOptions(ContentType: TemplateContentType.Html, Culture: "pt-BR", TimeZone: "America/Sao_Paulo", ApplySchemaDefaults: true);
        using var effective = RuneTemplateEngine.ApplySchemaDefaults(data.RootElement, schema.RootElement, options);
        RuneTemplateEngine.ValidateSchema(effective.RootElement, schema.RootElement, options);
        var result = RuneTemplateEngine.Expand("{{label}} {{date when \"dd/MM/yyyy HH:mm\"}}", effective.RootElement, options);
        Assert.Contains("generated 27/07/2026 22:30", result.Content);

        using var invalid = JsonDocument.Parse("""{"when":"not-a-date","extra":true}""");
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.ValidateSchema(invalid.RootElement, schema.RootElement, options));
    }

    [Fact]
    public void Raw_interpolation_rejects_untyped_strings()
    {
        using var data = JsonDocument.Parse("""{"raw":"<b>not typed</b>"}""");
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.Expand("{{{raw}}}", data.RootElement,
            new RuneTemplateOptions(ContentType: TemplateContentType.Html, AllowRawInterpolation: true)));
    }

    [Fact]
    public void Rejects_partial_cycles_and_non_allowlisted_helpers()
    {
        using var data = JsonDocument.Parse("""{"name":"RUNE"}""");
        var resources = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["partials/a.md"] = "{{> b}}",
            ["partials/b.md"] = "{{> a}}"
        };
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.Expand("{{> a}}", data.RootElement, new RuneTemplateOptions(), resources));
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.Expand("{{lower name}}", data.RootElement,
            new RuneTemplateOptions(AllowedHelpers: ["upper"])));
    }

    [Fact]
    public void Executes_user_defined_deterministic_helper_pipelines()
    {
        using var data = JsonDocument.Parse("""{"name":"  rune platform  "}""");
        var helper = new RuneTemplateHelperDefinition("product-label", [
            new RuneTemplateHelperOperation("trim"),
            new RuneTemplateHelperOperation("upper"),
            new RuneTemplateHelperOperation("prefix", "DOC: "),
            new RuneTemplateHelperOperation("replace", "PLATFORM", "ENGINE")
        ]);
        var result = RuneTemplateEngine.Expand("{{product-label name}}", data.RootElement,
            new RuneTemplateOptions(AllowedHelpers: ["product-label"], CustomHelpers: [helper]));
        Assert.Equal("DOC: RUNE ENGINE", result.Content);
        Assert.Throws<ArgumentException>(() => RuneTemplateEngine.Expand("{{bad name}}", data.RootElement,
            new RuneTemplateOptions(CustomHelpers: [new RuneTemplateHelperDefinition("bad", [new RuneTemplateHelperOperation("shell")])])));
    }

}
