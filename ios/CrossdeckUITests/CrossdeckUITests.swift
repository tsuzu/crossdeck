import XCTest

final class CrossdeckUITests: XCTestCase {
    /// Launch the app, prove its own chrome is on screen (i.e. the app was
    /// not hijacked into Safari by a page-initiated navigation), prove a
    /// web view exists, and capture what the first column actually shows.
    func testLaunchShowsAppChromeAndWebView() throws {
        let app = XCUIApplication()
        app.launch()

        let manageProfiles = app.buttons["Manage profiles"]
        XCTAssertTrue(manageProfiles.waitForExistence(timeout: 20), "app toolbar did not appear")

        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 20), "no WKWebView in the app")

        // Give X time to load, then look again: the toolbar must still be
        // there (foreground app is still crossdeck) after the page settles.
        Thread.sleep(forTimeInterval: 10)
        XCTAssertTrue(manageProfiles.exists, "app chrome disappeared after page load (app likely backgrounded)")
        XCTAssertEqual(app.state, .runningForeground)

        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "launch"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
