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

    /// Regression test: touching a column's web view must make that column
    /// the active one. Previously activation only came from a SwiftUI tap
    /// gesture that WKWebView touches never reach, so the active tab stayed
    /// on the leftmost column and all keyboard shortcuts acted on it.
    ///
    /// Observable proxy: column fullscreen applies to the active tab. After
    /// tapping the FIRST column, fullscreen must show the first (Default)
    /// column, not the freshly created second one.
    func testTappingColumnWebViewActivatesThatColumn() throws {
        let app = XCUIApplication()
        app.launch()

        // Add a second profile.
        let manageProfiles = app.buttons["Manage profiles"]
        XCTAssertTrue(manageProfiles.waitForExistence(timeout: 20))
        manageProfiles.tap()
        let nameField = app.textFields["Profile name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10))
        nameField.tap()
        nameField.typeText("SecondA")
        app.buttons["Add Profile"].tap()
        app.buttons["Done"].tap()

        // Open a tab for it (becomes the active tab on creation).
        let newTab = app.buttons["New tab"]
        XCTAssertTrue(newTab.waitForExistence(timeout: 10))
        newTab.tap()
        let secondItem = app.buttons["SecondA"]
        XCTAssertTrue(secondItem.waitForExistence(timeout: 10))
        secondItem.tap()
        XCTAssertTrue(app.webViews.element(boundBy: 1).waitForExistence(timeout: 10), "second column did not appear")

        // Touch inside the FIRST column's web view.
        Thread.sleep(forTimeInterval: 3)
        app.webViews.element(boundBy: 0).tap()

        // Fullscreen follows the active tab: only Default may remain.
        let fullscreen = app.buttons["Toggle column fullscreen"]
        XCTAssertTrue(fullscreen.waitForExistence(timeout: 10))
        fullscreen.tap()

        let secondBadge = app.staticTexts["SecondA"]
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline && secondBadge.exists {
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTAssertFalse(secondBadge.exists, "fullscreen showed the second column — tapping the first column did not activate it")
        XCTAssertTrue(app.staticTexts["Default"].exists)
    }

    /// Regression test: keyboard focus (first responder) must follow the
    /// tapped column. X's own page shortcuts ("g h", j/k, ...) are
    /// delivered to whichever web view is first responder; when focus
    /// stayed on the leftmost web view, keys meant for another column
    /// were absorbed by the leftmost page.
    ///
    /// Verified with the debug focus-recorder page (homepage
    /// "crossdeck-keytest", DEBUG builds only): it mirrors
    /// document.hasFocus() into its title, visible as the column header.
    /// Focus must leave the recorder when the first column is tapped and
    /// return when the recorder column is tapped again. (An earlier
    /// version typed real keys via XCUI typeKey; HID delivery in the
    /// simulator proved too flaky to assert on.)
    func testTappingColumnMovesPageFocus() throws {
        let app = XCUIApplication()
        app.launch()

        let manageProfiles = app.buttons["Manage profiles"]
        XCTAssertTrue(manageProfiles.waitForExistence(timeout: 20))
        manageProfiles.tap()
        let nameField = app.textFields["Profile name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10))
        nameField.tap()
        nameField.typeText("KeysF")
        let homepageField = app.textFields["Homepage URL (default: https://x.com)"]
        XCTAssertTrue(homepageField.waitForExistence(timeout: 10))
        homepageField.tap()
        homepageField.typeText("crossdeck-keytest")
        app.buttons["Add Profile"].tap()
        app.buttons["Done"].tap()

        let newTab = app.buttons["New tab"]
        XCTAssertTrue(newTab.waitForExistence(timeout: 10))
        newTab.tap()
        let keysItem = app.buttons["KeysF"]
        XCTAssertTrue(keysItem.waitForExistence(timeout: 10))
        keysItem.tap()

        // The freshly created (active) recorder column holds page focus.
        XCTAssertTrue(waitForStaticText("focused", in: app, timeout: 15), "recorder page did not report focus after creation")

        // Tap the first column: focus must leave the recorder.
        tapColumnContent(below: app.staticTexts["Default"], in: app)
        XCTAssertTrue(waitForStaticText("blurred", in: app, timeout: 10), "recorder page kept focus after tapping the first column")

        // Tap the recorder column (its header now reads "blurred"):
        // focus must come back.
        tapColumnContent(below: app.staticTexts["blurred"], in: app)
        XCTAssertTrue(waitForStaticText("focused", in: app, timeout: 10), "recorder page did not regain focus after tapping it")
    }

    private func waitForStaticText(_ label: String, in app: XCUIApplication, timeout: TimeInterval) -> Bool {
        let element = app.staticTexts[label]
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if element.exists { return true }
            Thread.sleep(forTimeInterval: 0.5)
        }
        return element.exists
    }

    /// Tap inside a column's web view area, addressed by a header element
    /// belonging to that column (badge or title), 120pt below the header.
    private func tapColumnContent(below headerElement: XCUIElement, in app: XCUIApplication) {
        XCTAssertTrue(headerElement.waitForExistence(timeout: 10), "header element not found")
        let headerFrame = headerElement.frame
        let window = app.frame
        let point = app.coordinate(withNormalizedOffset: CGVector(
            dx: (headerFrame.minX + 60) / window.width,
            dy: (headerFrame.maxY + 120) / window.height
        ))
        point.tap()
    }
}
