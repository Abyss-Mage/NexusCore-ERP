package services

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"strings"

	"github.com/anirban-guha/invoicecore/internal/config"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// GeneratePDF renders HTML to PDF using headless Chrome via chromedp
func GeneratePDF(htmlContent string) ([]byte, error) {
	execPath := config.AppConfig.PuppeteerExecutablePath

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
	)

	if execPath != "" {
		opts = append(opts, chromedp.ExecPath(execPath))
	}

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	var pdfBuf []byte
	if err := chromedp.Run(ctx,
		chromedp.Navigate("about:blank"),
		chromedp.ActionFunc(func(ctx context.Context) error {
			jsonHTML, _ := json.Marshal(htmlContent)
			js := fmt.Sprintf("document.open(); document.write(%s); document.close();", string(jsonHTML))
			return chromedp.Evaluate(js, nil).Do(ctx)
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBuf, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithPaperWidth(8.27).WithPaperHeight(11.69). // A4
				WithMarginTop(0.4).WithMarginBottom(0.4).
				WithMarginLeft(0.4).WithMarginRight(0.4).
				Do(ctx)
			return err
		}),
	); err != nil {
		return nil, fmt.Errorf("PDF generation failed: %w", err)
	}

	return pdfBuf, nil
}

// RenderTemplate renders an HTML template with the given data
func RenderTemplate(tmplContent string, data interface{}) (string, error) {
	funcMap := template.FuncMap{
		"inc": func(i int) int { return i + 1 },
		"fmtFloat": func(f interface{}) string {
			switch v := f.(type) {
			case float64:
				return fmt.Sprintf("%.2f", v)
			case float32:
				return fmt.Sprintf("%.2f", v)
			default:
				return fmt.Sprintf("%v", v)
			}
		},
		"derefStr": func(s *string) string {
			if s == nil {
				return ""
			}
			return *s
		},
	}

	tmpl, err := template.New("document").Funcs(funcMap).Parse(tmplContent)
	if err != nil {
		return "", fmt.Errorf("template parse error: %w", err)
	}

	var buf strings.Builder
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("template execute error: %w", err)
	}

	return buf.String(), nil
}

// CheckChromePath verifies the Chrome executable is accessible
func CheckChromePath() bool {
	execPath := config.AppConfig.PuppeteerExecutablePath

	// Quick test by creating an allocator
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
	)
	if execPath != "" {
		opts = append(opts, chromedp.ExecPath(execPath))
	}

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	err := chromedp.Run(ctx, chromedp.Navigate("about:blank"))
	if err != nil {
		log.Printf("❌ Chrome path invalid: %v", err)
		return false
	}

	log.Println("✅ Chrome executable verified for PDF generation")
	return true
}
