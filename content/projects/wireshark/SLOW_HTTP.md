---
type: how-to
id: WS-NET-001
owner: Karan Deshmukh
author: Karan Deshmukh
version: 1.0
status: Published
date: 2026-11-20
---
# Find the slowest HTTP responses in a capture with tshark

When people report that a web application is slow, a capture of its traffic shows which requests waited, and for how long. Wireshark's command-line tool, tshark, measures the time between each request and its response. You can then list the slowest responses and find the requests behind them.

For administrators and support engineers who troubleshoot web applications. Written for tshark 4.2.2 and checked against it on Ubuntu 24.04, with a capture of a small test server written for this guide. This is an independent guide, not official Wireshark documentation.

## Before you start

- Install tshark. On Ubuntu or Debian, run `sudo apt install tshark`. Capturing traffic needs root, or the setup for capturing without root that your system documents. Reading a capture file doesn't.
- Capture only traffic that you're allowed to capture. A capture holds everything that the computers sent: on a connection that isn't encrypted, that includes passwords and tokens.
- These commands read HTTP that isn't encrypted. A capture of HTTPS shows only encrypted TLS records unless tshark has the session keys.
- To follow the guide as written, download the sample capture [web.pcapng](/docs/wireshark/sample/web.pcapng). It holds ten requests that [traffic.sh](/docs/wireshark/sample/traffic.sh) sent to the test server [shop_api.py](/docs/wireshark/sample/shop_api.py), an example parts shop on `127.0.0.1:8000`.

## Steps

1. Capture the traffic to a file while the slow requests happen. This command captures the traffic of port 8000 on the loopback interface, `lo`, and stops after 12 seconds.

   ```
   tshark -i lo -f "tcp port 8000" -a duration:12 -w web.pcapng
   ```

   tshark reports the interface and the number of packets that it captured.

   ```
   Capturing on 'Loopback: lo'
   120 packets captured
   ```

   To list the interfaces of your computer, run `tshark -D`. If you already have a capture file, go to step 2.

2. List every response, with the time since its request in seconds.

   ```
   tshark -r web.pcapng -Y http.response -T fields -e frame.number -e http.response_for.uri -e http.response.code -e http.time
   ```

   Each line is one response: its frame number, the address that it answers, its status code, and the time since the request.

   ```
   8	http://127.0.0.1:8000/health	200	0.011127956
   20	http://127.0.0.1:8000/api/parts	200	0.010899343
   32	http://127.0.0.1:8000/api/parts?page=2	200	0.010755734
   44	http://127.0.0.1:8000/api/search?q=impeller	200	0.400836014
   56	http://127.0.0.1:8000/api/report?month=2026-10	200	1.201125948
   68	http://127.0.0.1:8000/api/parts?page=3	200	0.011001642
   80	http://127.0.0.1:8000/api/search?q=seal	200	0.400769448
   92	http://127.0.0.1:8000/api/report?month=2026-11	200	1.201089440
   104	http://127.0.0.1:8000/api/parts/9101	404	0.010994395
   116	http://127.0.0.1:8000/health	200	0.010976470
   ```

3. Keep only the responses that took more than half a second, with a display filter on `http.time`.

   ```
   tshark -r web.pcapng -Y "http.response && http.time > 0.5" -T fields -e frame.number -e http.response_for.uri -e http.response.code -e http.time
   ```

   ```
   56	http://127.0.0.1:8000/api/report?month=2026-10	200	1.201125948
   92	http://127.0.0.1:8000/api/report?month=2026-11	200	1.201089440
   ```

   In a long capture, put the time first and sort the lines, so that the slowest come first.

   ```
   tshark -r web.pcapng -Y http.response -T fields -e http.time -e http.response.code -e http.response_for.uri | sort -gr | head -5
   ```

   ```
   1.201125948	200	http://127.0.0.1:8000/api/report?month=2026-10
   1.201089440	200	http://127.0.0.1:8000/api/report?month=2026-11
   0.400836014	200	http://127.0.0.1:8000/api/search?q=impeller
   0.400769448	200	http://127.0.0.1:8000/api/search?q=seal
   0.011127956	200	http://127.0.0.1:8000/health
   ```

4. Find the request that each slow response answers. The field `http.request_in` gives the request's frame number.

   ```
   tshark -r web.pcapng -Y "http.response && http.time > 0.5" -T fields -e frame.number -e http.request_in
   ```

   ```
   56	52
   92	88
   ```

5. Read the request. This command shows when the client sent it, in seconds from the start of the capture, its method, its address and the client.

   ```
   tshark -r web.pcapng -Y "frame.number == 52" -T fields -e frame.time_relative -e http.request.method -e http.request.uri -e http.user_agent
   ```

   ```
   0.459699244	GET	/api/report?month=2026-10	curl/8.5.0
   ```

## Check the result

If the server logs how long it takes, compare the two. The test server logged 1.201 seconds for the first report and 1.200 seconds for the second, the same as the capture to about a millisecond. Both requests for a report took 1.2 seconds, and nothing else took more than half a second, so the place to look is the report endpoint.

To count the responses by status code, run `tshark -r web.pcapng -q -z http,stat`. In the sample, nine responses are `200 OK`, and one is `404 Not Found`.

## What the time measures

`http.time` is the time between the request and the response as the capture recorded them. A capture taken on the server, as here, shows how long the server took. A capture taken on a client also includes the time on the network, so compare both when you need to know where the time goes.
