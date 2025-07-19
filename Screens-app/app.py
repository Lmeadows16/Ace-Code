#app.py
import threading
import webview
import tempfile
import os
from flask import Flask

# --- configure Flask to serve the static HTML and assets ---
server = Flask(
    __name__,
    static_folder='',       # serve files from the current folder
    static_url_path=''      # at the root URl
)

@server.route('/')
def index():
    return server.send_static_file('index.html')

class API:
    def open_detail(self, html):
        # launches a native window with the HTML
        webview.create_window('Repair Details', html=html, width=800, height=1000)
        
        def open_new_window(self, html):
            tf = tempfile.NamedTemporaryFile('w', delete=False, suffix='.html')
            tf.write(html)
            tf.close()
            file_url= f'file://{tf.name}'
            
            webview.create_window("Repair Details (New Window)", file_url, width=800, height=1000)

def start_server():
    # turn off reloader & debug so it doesn't spawn extra processes
    server.run(port=5000, debug=False, use_reloader=False)
    
if __name__ == '__main__':
    api = API()
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    
    webview.create_window(
        "Screen & Window Repair",
        'http://127.0.0.1:5000/',
        js_api = api,
        width=800,
        height=1000,
        resizable=True
    )
    
    webview.start()
    