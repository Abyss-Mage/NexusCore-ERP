package handlers

// BuiltinTemplate holds metadata and content for a built-in template.
type BuiltinTemplate struct {
	Name    string
	Type    string // "invoice" or "quotation"
	Content func() string
}

// builtinTemplates returns all built-in templates.
func builtinTemplates() []BuiltinTemplate {
	return []BuiltinTemplate{
		{Name: "professional", Type: "invoice", Content: defaultInvoiceTemplate},
		{Name: "classic", Type: "invoice", Content: classicInvoiceTemplate},
		{Name: "minimal", Type: "invoice", Content: minimalInvoiceTemplate},
		{Name: "professional", Type: "quotation", Content: defaultQuotationTemplate},
		{Name: "classic", Type: "quotation", Content: classicQuotationTemplate},
		{Name: "minimal", Type: "quotation", Content: minimalQuotationTemplate},
	}
}

// getBuiltinTemplate returns the template content for a built-in template by name and type.
func getBuiltinTemplate(name, tplType string) (string, bool) {
	for _, t := range builtinTemplates() {
		if t.Name == name && t.Type == tplType {
			return t.Content(), true
		}
	}
	return "", false
}

// ---------- Classic Invoice Template ----------

func classicInvoiceTemplate() string {
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;color:#111;font-size:13px;line-height:1.6}
.page{padding:40px 50px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #111;margin-bottom:20px}
.header-left{display:flex;align-items:center;gap:14px}
.logo{max-height:60px;max-width:160px;object-fit:contain}
.company-name{font-size:20px;font-weight:700;color:#111}
.company-details{font-size:10px;color:#555;margin-top:2px}
.company-details span{display:block}
.doc-title{font-size:28px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#111}
.doc-number{font-size:12px;color:#666;text-align:right;margin-top:4px}
.meta-row{display:flex;justify-content:space-between;margin-bottom:20px}
.meta-block{width:48%}
.meta-block h3{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:1.5px;margin-bottom:6px;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:4px}
.meta-block p{margin:2px 0;font-size:12px;color:#333}
.meta-block .name{font-size:13px;font-weight:700;color:#111}
table.items{width:100%;border-collapse:collapse;margin:0 0 16px}
table.items th{background:#f5f5f5;color:#333;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;padding:8px 10px;text-align:left;border-top:1px solid #999;border-bottom:1px solid #999;font-weight:700}
table.items td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#333}
table.items tr:last-child td{border-bottom:1px solid #999}
.text-right{text-align:right}
.summary-section{display:flex;justify-content:space-between;margin-top:10px}
.bank-section{width:55%;font-size:10px;color:#555}
.bank-section h4{font-size:11px;font-weight:700;color:#111;margin-bottom:4px}
.bank-section p{margin:1px 0}
.totals-section{width:40%}
.totals-section table{width:100%;border-collapse:collapse}
.totals-section td{padding:4px 8px;font-size:12px}
.totals-section .label{color:#666;text-align:left}
.totals-section .value{text-align:right;font-weight:500}
.totals-section .grand-total td{font-size:15px;font-weight:700;color:#111;border-top:2px solid #111;padding-top:8px}
.auth-section{display:flex;justify-content:flex-end;margin-top:50px;padding-top:20px}
.auth-block{text-align:center;position:relative;min-width:200px}
.stamp-img{max-height:70px;max-width:110px;object-fit:contain;opacity:0.7;position:absolute;top:-25px;left:50%;transform:translateX(-50%)}
.sig-img{max-height:50px;max-width:140px;object-fit:contain;margin-bottom:6px}
.sig-line{border-top:1px solid #111;padding-top:4px;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px}
.remarks{margin-top:20px;padding:10px 14px;border:1px solid #ddd;font-size:11px;color:#555}
.remarks strong{color:#111}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;text-align:center;font-size:9px;color:#999;letter-spacing:0.5px}
</style></head><body>
<div class="page">

<div class="header">
<div class="header-left">
{{if .Logo}}<img class="logo" src="{{.Logo}}" alt="Logo"/>{{end}}
<div>
<div class="company-name">{{with .Company}}{{index . "company_name"}}{{else}}Company{{end}}</div>
<div class="company-details">
{{with .Company}}{{with index . "gstin"}}<span>GSTIN: {{.}}</span>{{end}}{{with index . "cin"}}<span>CIN: {{.}}</span>{{end}}{{with index . "address"}}<span>{{.}}</span>{{end}}{{with index . "phone"}}<span>Ph: {{.}}</span>{{end}}{{with index . "email"}}<span>{{.}}</span>{{end}}{{end}}
</div>
</div>
</div>
<div style="text-align:right">
<div class="doc-title">Invoice</div>
<div class="doc-number">{{.Invoice.InvoiceNumber}}</div>
</div>
</div>

<div class="meta-row">
<div class="meta-block">
<h3>Bill To</h3>
<p class="name">{{.Invoice.Client.CompanyName}}</p>
{{with .Invoice.Client.ContactPerson}}<p>{{.}}</p>{{end}}
{{with .Invoice.Client.Email}}<p>{{.}}</p>{{end}}
{{with .Invoice.Client.Phone}}<p>{{.}}</p>{{end}}
{{with .ClientAddress}}<p>{{.}}</p>{{end}}
{{with .Invoice.Client.TaxID}}<p><strong>GSTIN:</strong> {{.}}</p>{{end}}
</div>
<div class="meta-block" style="text-align:right">
<h3>Details</h3>
<p><strong>Date:</strong> {{.Invoice.IssueDate.Format "02 Jan 2006"}}</p>
{{with .Invoice.DueDate}}<p><strong>Due:</strong> {{.Format "02 Jan 2006"}}</p>{{end}}
<p><strong>Status:</strong> {{.Invoice.Status}}</p>
<p><strong>Currency:</strong> {{.Invoice.Currency}}</p>
</div>
</div>

<table class="items">
<thead><tr><th>#</th><th>Description</th><th>Item Code</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
<tbody>
{{range $i, $item := .Invoice.LineItems}}
<tr>
<td>{{inc $i}}</td>
<td>{{index $item "description"}}</td>
<td>{{with index $item "hsn"}}{{.}}{{end}}</td>
<td class="text-right">{{index $item "qty"}}</td>
<td class="text-right">{{index $item "rate"}}</td>
<td class="text-right">{{index $item "amount"}}</td>
</tr>
{{end}}
</tbody>
</table>

<div class="summary-section">
<div class="bank-section">
{{with .Invoice.BankAccount}}
<h4>Bank Details</h4>
<p><strong>Bank:</strong> {{.BankName}}</p>
<p><strong>A/C:</strong> {{.AccountNumber}}</p>
{{with .IFSCCode}}<p><strong>IFSC:</strong> {{.}}</p>{{end}}
{{with .SwiftCode}}<p><strong>SWIFT:</strong> {{.}}</p>{{end}}
{{with .UPIID}}<p><strong>UPI:</strong> {{.}}</p>{{end}}
{{end}}
</div>
<div class="totals-section">
<table>
<tr><td class="label">Subtotal</td><td class="value">{{printf "%.2f" .Invoice.Subtotal}}</td></tr>
{{range .TaxRows}}<tr><td class="label">{{.Label}}</td><td class="value">{{.Amount}}</td></tr>{{end}}
<tr class="grand-total"><td class="label">Grand Total ({{.Invoice.Currency}})</td><td class="value">{{printf "%.2f" .Invoice.GrandTotal}}</td></tr>
</table>
</div>
</div>

{{with .Invoice.Remarks}}<div class="remarks"><strong>Remarks:</strong> {{.}}</div>{{end}}

<div class="auth-section">
<div class="auth-block">
{{if $.Stamp}}<img class="stamp-img" src="{{$.Stamp}}" alt="Stamp"/>{{end}}
{{if $.Signature}}<img class="sig-img" src="{{$.Signature}}" alt="Signature"/>{{end}}
<div class="sig-line">Authorized Signatory</div>
</div>
</div>

<div class="footer">Generated by InvoiceCore</div>
</div>
</body></html>`
}

// ---------- Minimal Invoice Template ----------

func minimalInvoiceTemplate() string {
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#222;font-size:13px;line-height:1.7}
.page{padding:50px 55px}
.top{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:40px}
.brand{display:flex;align-items:center;gap:12px}
.logo{max-height:48px;max-width:140px;object-fit:contain}
.company-name{font-size:18px;font-weight:600;letter-spacing:-0.3px}
.tag{font-size:36px;font-weight:300;color:#bbb;text-transform:uppercase;letter-spacing:6px}
.divider{height:1px;background:#e5e5e5;margin:0 0 30px}
.grid{display:flex;gap:40px;margin-bottom:30px}
.col{flex:1}
.col h4{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#aaa;margin-bottom:8px;font-weight:600}
.col p{font-size:12px;margin:1px 0;color:#444}
.col .primary{font-size:13px;font-weight:600;color:#222}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;padding:8px 0;text-align:left;border-bottom:1px solid #e5e5e5;font-weight:600}
td{padding:10px 0;font-size:12px;color:#444;border-bottom:1px solid #f5f5f5}
.text-right{text-align:right}
.totals{display:flex;justify-content:flex-end}
.totals-box{width:250px}
.totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#666}
.totals-row.total{font-size:16px;font-weight:600;color:#222;border-top:1px solid #222;padding-top:10px;margin-top:6px}
.bank-info{margin-top:24px;font-size:10px;color:#888}
.bank-info strong{color:#555}
.sig-area{display:flex;justify-content:flex-end;margin-top:50px}
.sig-box{text-align:center;min-width:180px;position:relative}
.stamp-img{max-height:60px;max-width:100px;object-fit:contain;opacity:0.6;position:absolute;top:-20px;left:50%;transform:translateX(-50%)}
.sig-img{max-height:44px;max-width:130px;object-fit:contain;margin-bottom:6px}
.sig-label{border-top:1px solid #ddd;padding-top:4px;font-size:9px;color:#bbb;text-transform:uppercase;letter-spacing:1.5px}
.note{margin-top:20px;font-size:11px;color:#888;font-style:italic}
.foot{margin-top:40px;text-align:center;font-size:9px;color:#ccc}
</style></head><body>
<div class="page">

<div class="top">
<div class="brand">
{{if .Logo}}<img class="logo" src="{{.Logo}}" alt=""/>{{end}}
<div class="company-name">{{with .Company}}{{index . "company_name"}}{{else}}Company{{end}}</div>
</div>
<div class="tag">Invoice</div>
</div>

<div class="divider"></div>

<div class="grid">
<div class="col">
<h4>From</h4>
{{with .Company}}
<p class="primary">{{index . "company_name"}}</p>
{{with index . "address"}}<p>{{.}}</p>{{end}}
{{with index . "phone"}}<p>{{.}}</p>{{end}}
{{with index . "email"}}<p>{{.}}</p>{{end}}
{{with index . "gstin"}}<p>GSTIN: {{.}}</p>{{end}}
{{end}}
</div>
<div class="col">
<h4>Bill To</h4>
<p class="primary">{{.Invoice.Client.CompanyName}}</p>
{{with .Invoice.Client.ContactPerson}}<p>{{.}}</p>{{end}}
{{with .Invoice.Client.Email}}<p>{{.}}</p>{{end}}
{{with .ClientAddress}}<p>{{.}}</p>{{end}}
{{with .Invoice.Client.TaxID}}<p>GSTIN: {{.}}</p>{{end}}
</div>
<div class="col">
<h4>Invoice</h4>
<p class="primary">{{.Invoice.InvoiceNumber}}</p>
<p>{{.Invoice.IssueDate.Format "02 Jan 2006"}}</p>
{{with .Invoice.DueDate}}<p>Due: {{.Format "02 Jan 2006"}}</p>{{end}}
<p>{{.Invoice.Currency}}</p>
</div>
</div>

<table>
<thead><tr><th>#</th><th>Description</th><th>Item Code</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
<tbody>
{{range $i, $item := .Invoice.LineItems}}
<tr>
<td>{{inc $i}}</td>
<td>{{index $item "description"}}</td>
<td>{{with index $item "hsn"}}{{.}}{{end}}</td>
<td class="text-right">{{index $item "qty"}}</td>
<td class="text-right">{{index $item "rate"}}</td>
<td class="text-right">{{index $item "amount"}}</td>
</tr>
{{end}}
</tbody>
</table>

<div class="totals">
<div class="totals-box">
<div class="totals-row"><span>Subtotal</span><span>{{printf "%.2f" .Invoice.Subtotal}}</span></div>
{{range .TaxRows}}<div class="totals-row"><span>{{.Label}}</span><span>{{.Amount}}</span></div>{{end}}
<div class="totals-row total"><span>Total ({{.Invoice.Currency}})</span><span>{{printf "%.2f" .Invoice.GrandTotal}}</span></div>
</div>
</div>

{{with .Invoice.BankAccount}}
<div class="bank-info">
<strong>Bank:</strong> {{.BankName}} &nbsp;|&nbsp; <strong>A/C:</strong> {{.AccountNumber}}
{{with .IFSCCode}} &nbsp;|&nbsp; <strong>IFSC:</strong> {{.}}{{end}}
{{with .UPIID}} &nbsp;|&nbsp; <strong>UPI:</strong> {{.}}{{end}}
</div>
{{end}}

{{with .Invoice.Remarks}}<div class="note">{{.}}</div>{{end}}

<div class="sig-area">
<div class="sig-box">
{{if $.Stamp}}<img class="stamp-img" src="{{$.Stamp}}" alt=""/>{{end}}
{{if $.Signature}}<img class="sig-img" src="{{$.Signature}}" alt=""/>{{end}}
<div class="sig-label">Authorized Signatory</div>
</div>
</div>

<div class="foot">Generated by InvoiceCore</div>
</div>
</body></html>`
}

// ---------- Classic Quotation Template ----------

func classicQuotationTemplate() string {
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;color:#111;font-size:13px;line-height:1.6}
.page{padding:40px 50px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #111;margin-bottom:20px}
.header-left{display:flex;align-items:center;gap:14px}
.logo{max-height:60px;max-width:160px;object-fit:contain}
.company-name{font-size:20px;font-weight:700;color:#111}
.company-details{font-size:10px;color:#555;margin-top:2px}
.company-details span{display:block}
.doc-title{font-size:28px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#111}
.doc-number{font-size:12px;color:#666;text-align:right;margin-top:4px}
.meta-row{display:flex;justify-content:space-between;margin-bottom:20px}
.meta-block{width:48%}
.meta-block h3{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:1.5px;margin-bottom:6px;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:4px}
.meta-block p{margin:2px 0;font-size:12px;color:#333}
.meta-block .name{font-size:13px;font-weight:700;color:#111}
table.items{width:100%;border-collapse:collapse;margin:0 0 16px}
table.items th{background:#f5f5f5;color:#333;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;padding:8px 10px;text-align:left;border-top:1px solid #999;border-bottom:1px solid #999;font-weight:700}
table.items td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#333}
table.items tr:last-child td{border-bottom:1px solid #999}
.text-right{text-align:right}
.totals-wrap{display:flex;justify-content:flex-end;margin-top:10px}
.totals-section{width:40%}
.totals-section table{width:100%;border-collapse:collapse}
.totals-section td{padding:4px 8px;font-size:12px}
.totals-section .label{color:#666;text-align:left}
.totals-section .value{text-align:right;font-weight:500}
.totals-section .grand-total td{font-size:15px;font-weight:700;color:#111;border-top:2px solid #111;padding-top:8px}
.section-box{margin-top:16px;padding:10px 14px;border:1px solid #ddd;font-size:11px;color:#555}
.section-box h4{font-size:11px;font-weight:700;color:#111;margin-bottom:4px}
.validity{margin-top:14px;padding:8px 14px;background:#fff8e1;border:1px solid #f0e0a0;font-size:11px;color:#7a6200;text-align:center}
.auth-section{display:flex;justify-content:flex-end;margin-top:50px;padding-top:20px}
.auth-block{text-align:center;position:relative;min-width:200px}
.stamp-img{max-height:70px;max-width:110px;object-fit:contain;opacity:0.7;position:absolute;top:-25px;left:50%;transform:translateX(-50%)}
.sig-img{max-height:50px;max-width:140px;object-fit:contain;margin-bottom:6px}
.sig-line{border-top:1px solid #111;padding-top:4px;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;text-align:center;font-size:9px;color:#999}
</style></head><body>
<div class="page">

<div class="header">
<div class="header-left">
{{if .Logo}}<img class="logo" src="{{.Logo}}" alt="Logo"/>{{end}}
<div>
<div class="company-name">{{with .Company}}{{index . "company_name"}}{{else}}Company{{end}}</div>
<div class="company-details">
{{with .Company}}{{with index . "gstin"}}<span>GSTIN: {{.}}</span>{{end}}{{with index . "address"}}<span>{{.}}</span>{{end}}{{with index . "phone"}}<span>Ph: {{.}}</span>{{end}}{{with index . "email"}}<span>{{.}}</span>{{end}}{{end}}
</div>
</div>
</div>
<div style="text-align:right">
<div class="doc-title">Quotation</div>
<div class="doc-number">{{.Quotation.QuotationNumber}}</div>
</div>
</div>

<div class="meta-row">
<div class="meta-block">
<h3>Prepared For</h3>
<p class="name">{{.Quotation.Client.CompanyName}}</p>
{{with .Quotation.Client.ContactPerson}}<p>{{.}}</p>{{end}}
{{with .Quotation.Client.Email}}<p>{{.}}</p>{{end}}
{{with .Quotation.Client.Phone}}<p>{{.}}</p>{{end}}
{{with .ClientAddress}}<p>{{.}}</p>{{end}}
</div>
<div class="meta-block" style="text-align:right">
<h3>Details</h3>
<p><strong>Date:</strong> {{.Quotation.IssueDate.Format "02 Jan 2006"}}</p>
{{with .Quotation.ExpiryDate}}<p><strong>Valid Until:</strong> {{.Format "02 Jan 2006"}}</p>{{end}}
<p><strong>Status:</strong> {{.Quotation.Status}}</p>
<p><strong>Currency:</strong> {{.Quotation.Currency}}</p>
</div>
</div>

<table class="items">
<thead><tr><th>#</th><th>Description</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
<tbody>
{{range $i, $item := .Quotation.LineItems}}
<tr>
<td>{{inc $i}}</td>
<td>{{index $item "description"}}</td>
<td class="text-right">{{index $item "qty"}}</td>
<td class="text-right">{{index $item "rate"}}</td>
<td class="text-right">{{index $item "amount"}}</td>
</tr>
{{end}}
</tbody>
</table>

<div class="totals-wrap">
<div class="totals-section">
<table>
<tr><td class="label">Subtotal</td><td class="value">{{printf "%.2f" .Quotation.Subtotal}}</td></tr>
<tr class="grand-total"><td class="label">Total ({{.Quotation.Currency}})</td><td class="value">{{printf "%.2f" .Quotation.GrandTotal}}</td></tr>
</table>
</div>
</div>

{{with .Quotation.ServicesOffered}}<div class="section-box"><h4>Services Offered</h4>{{.}}</div>{{end}}
{{with .Quotation.ContractTerms}}<div class="section-box"><h4>Terms &amp; Conditions</h4>{{.}}</div>{{end}}
{{with .Quotation.Remarks}}<div class="section-box"><h4>Remarks</h4>{{.}}</div>{{end}}

{{with .Quotation.ExpiryDate}}<div class="validity">This quotation is valid until {{.Format "02 January 2006"}}.</div>{{end}}

<div class="auth-section">
<div class="auth-block">
{{if $.Stamp}}<img class="stamp-img" src="{{$.Stamp}}" alt="Stamp"/>{{end}}
{{if $.Signature}}<img class="sig-img" src="{{$.Signature}}" alt="Signature"/>{{end}}
<div class="sig-line">Authorized Signatory</div>
</div>
</div>

<div class="footer">Generated by InvoiceCore</div>
</div>
</body></html>`
}

// ---------- Minimal Quotation Template ----------

func minimalQuotationTemplate() string {
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#222;font-size:13px;line-height:1.7}
.page{padding:50px 55px}
.top{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:40px}
.brand{display:flex;align-items:center;gap:12px}
.logo{max-height:48px;max-width:140px;object-fit:contain}
.company-name{font-size:18px;font-weight:600;letter-spacing:-0.3px}
.tag{font-size:36px;font-weight:300;color:#bbb;text-transform:uppercase;letter-spacing:6px}
.divider{height:1px;background:#e5e5e5;margin:0 0 30px}
.grid{display:flex;gap:40px;margin-bottom:30px}
.col{flex:1}
.col h4{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#aaa;margin-bottom:8px;font-weight:600}
.col p{font-size:12px;margin:1px 0;color:#444}
.col .primary{font-size:13px;font-weight:600;color:#222}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;padding:8px 0;text-align:left;border-bottom:1px solid #e5e5e5;font-weight:600}
td{padding:10px 0;font-size:12px;color:#444;border-bottom:1px solid #f5f5f5}
.text-right{text-align:right}
.totals{display:flex;justify-content:flex-end}
.totals-box{width:250px}
.totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#666}
.totals-row.total{font-size:16px;font-weight:600;color:#222;border-top:1px solid #222;padding-top:10px;margin-top:6px}
.info-section{margin-top:20px;padding:12px 0;border-top:1px solid #f0f0f0;font-size:11px;color:#888}
.info-section h4{font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.validity-note{margin-top:16px;padding:10px;background:#fafafa;font-size:11px;color:#888;text-align:center;border-radius:4px}
.sig-area{display:flex;justify-content:flex-end;margin-top:50px}
.sig-box{text-align:center;min-width:180px;position:relative}
.stamp-img{max-height:60px;max-width:100px;object-fit:contain;opacity:0.6;position:absolute;top:-20px;left:50%;transform:translateX(-50%)}
.sig-img{max-height:44px;max-width:130px;object-fit:contain;margin-bottom:6px}
.sig-label{border-top:1px solid #ddd;padding-top:4px;font-size:9px;color:#bbb;text-transform:uppercase;letter-spacing:1.5px}
.foot{margin-top:40px;text-align:center;font-size:9px;color:#ccc}
</style></head><body>
<div class="page">

<div class="top">
<div class="brand">
{{if .Logo}}<img class="logo" src="{{.Logo}}" alt=""/>{{end}}
<div class="company-name">{{with .Company}}{{index . "company_name"}}{{else}}Company{{end}}</div>
</div>
<div class="tag">Quotation</div>
</div>

<div class="divider"></div>

<div class="grid">
<div class="col">
<h4>From</h4>
{{with .Company}}
<p class="primary">{{index . "company_name"}}</p>
{{with index . "address"}}<p>{{.}}</p>{{end}}
{{with index . "phone"}}<p>{{.}}</p>{{end}}
{{with index . "email"}}<p>{{.}}</p>{{end}}
{{end}}
</div>
<div class="col">
<h4>Prepared For</h4>
<p class="primary">{{.Quotation.Client.CompanyName}}</p>
{{with .Quotation.Client.ContactPerson}}<p>{{.}}</p>{{end}}
{{with .Quotation.Client.Email}}<p>{{.}}</p>{{end}}
{{with .ClientAddress}}<p>{{.}}</p>{{end}}
</div>
<div class="col">
<h4>Quotation</h4>
<p class="primary">{{.Quotation.QuotationNumber}}</p>
<p>{{.Quotation.IssueDate.Format "02 Jan 2006"}}</p>
{{with .Quotation.ExpiryDate}}<p>Valid: {{.Format "02 Jan 2006"}}</p>{{end}}
<p>{{.Quotation.Currency}}</p>
</div>
</div>

<table>
<thead><tr><th>#</th><th>Description</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
<tbody>
{{range $i, $item := .Quotation.LineItems}}
<tr>
<td>{{inc $i}}</td>
<td>{{index $item "description"}}</td>
<td class="text-right">{{index $item "qty"}}</td>
<td class="text-right">{{index $item "rate"}}</td>
<td class="text-right">{{index $item "amount"}}</td>
</tr>
{{end}}
</tbody>
</table>

<div class="totals">
<div class="totals-box">
<div class="totals-row"><span>Subtotal</span><span>{{printf "%.2f" .Quotation.Subtotal}}</span></div>
<div class="totals-row total"><span>Total ({{.Quotation.Currency}})</span><span>{{printf "%.2f" .Quotation.GrandTotal}}</span></div>
</div>
</div>

{{with .Quotation.ServicesOffered}}<div class="info-section"><h4>Services</h4>{{.}}</div>{{end}}
{{with .Quotation.ContractTerms}}<div class="info-section"><h4>Terms</h4>{{.}}</div>{{end}}
{{with .Quotation.Remarks}}<div class="info-section"><h4>Notes</h4>{{.}}</div>{{end}}

{{with .Quotation.ExpiryDate}}<div class="validity-note">Valid until {{.Format "02 January 2006"}}</div>{{end}}

<div class="sig-area">
<div class="sig-box">
{{if $.Stamp}}<img class="stamp-img" src="{{$.Stamp}}" alt=""/>{{end}}
{{if $.Signature}}<img class="sig-img" src="{{$.Signature}}" alt=""/>{{end}}
<div class="sig-label">Authorized Signatory</div>
</div>
</div>

<div class="foot">Generated by InvoiceCore</div>
</div>
</body></html>`
}
