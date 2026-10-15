$pub = 'c:\Users\Henry Camargo\Desktop\GameRunnig\public'
$out = 'c:\Users\Henry Camargo\Desktop\GameRunnig\runner_challenge_PORTABLE.html'

$html = [System.IO.File]::ReadAllText((Join-Path $pub 'index.html'), [System.Text.Encoding]::UTF8)
$css  = [System.IO.File]::ReadAllText((Join-Path $pub 'css\styles.css'), [System.Text.Encoding]::UTF8)

$jsFiles = @('audio.js','score.js','levels.js','collision.js','particles.js','camera.js','coins.js','obstacles.js','powerups.js','player.js','renderer.js','game.js','ui.js','main.js')
$allJs = ''
foreach ($f in $jsFiles) {
    $fPath = Join-Path $pub "js\$f"
    $content = [System.IO.File]::ReadAllText($fPath, [System.Text.Encoding]::UTF8)
    $allJs += "`n// === $f ===`n" + $content + "`n"
}

$googleFontImport = "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=Orbitron:wght@700;900&display=swap');"
$styleBlock = "<style>`n" + $googleFontImport + "`n" + $css + "`n</style>"

$html = $html -replace '<link[^>]*fonts\.googleapis[^>]*/>', ''
$html = $html -replace '<link rel="stylesheet" href="css/styles\.css" />', $styleBlock

$scriptBlock = "<script>`n" + $allJs + "`n</script>"
$html = [System.Text.RegularExpressions.Regex]::Replace($html, '(?s)<script src="js/audio\.js"></script>.*?<script src="js/main\.js"></script>', $scriptBlock)

[System.IO.File]::WriteAllText($out, $html, [System.Text.Encoding]::UTF8)
$kb = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "DONE: $out ($kb KB)"
