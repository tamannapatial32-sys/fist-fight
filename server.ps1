$port = 8000
$ip = [System.Net.IPAddress]::Loopback
$listener = New-Object System.Net.Sockets.TcpListener($ip, $port)

try {
    $listener.Start()
    Write-Host "=================================================="
    Write-Host "  FIST FIGHT Web Application Running!"
    Write-Host "  Local URL: http://localhost:$port/"
    Write-Host "=================================================="
    Start-Process "http://localhost:$port/"

    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        
        $requestLine = $reader.ReadLine()
        if (-not $requestLine) {
            $client.Close()
            continue
        }

        # Read remaining headers
        while ($line = $reader.ReadLine()) {
            if ([string]::IsNullOrWhiteSpace($line)) { break }
        }

        $parts = $requestLine.Split(' ')
        $url = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
        $path = $url.Split('?')[0].TrimStart('/').Replace('/', '\')
        if ([string]::IsNullOrWhiteSpace($path)) {
            $path = 'index.html'
        }
        $fullPath = Join-Path $PSScriptRoot $path

        if (Test-Path $fullPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = switch ($ext) {
                '.html' { 'text/html; charset=utf-8' }
                '.js'   { 'application/javascript; charset=utf-8' }
                '.css'  { 'text/css; charset=utf-8' }
                '.json' { 'application/json; charset=utf-8' }
                '.bin'  { 'application/octet-stream' }
                default { 'application/octet-stream' }
            }
            $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
        } else {
            $notFound = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: 9`r`nConnection: close`r`n`r`nNot Found"
            $errBytes = [System.Text.Encoding]::ASCII.GetBytes($notFound)
            $stream.Write($errBytes, 0, $errBytes.Length)
        }
        $stream.Flush()
        $client.Close()
    }
} catch {
    Write-Error $_
} finally {
    $listener.Stop()
}
