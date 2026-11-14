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
    /// Functional check with the debug key-recorder page (homepage
    /// "crossdeck-keytest", DEBUG builds only): it appends received keys
    /// to its title, visible as the column header. Type a key after
    /// tapping that column and the header must change to "kz".
    func testTappingColumnDeliversKeysToThatColumn() throws {
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

        let recorderTitle = app.staticTexts["k"]
        XCTAssertTrue(recorderTitle.waitForExistence(timeout: 15), "key recorder page did not load")

        // Move focus away to the first column, then back to the recorder.
        app.webViews.element(boundBy: 0).tap()
        Thread.sleep(forTimeInterval: 1)
        app.webViews.element(boundBy: 1).tap()
        Thread.sleep(forTimeInterval: 1)

        app.typeKey("z", modifierFlags: [])

        let updatedTitle = app.staticTexts["kz"]
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline && !updatedTitle.exists {
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTAssertTrue(updatedTitle.exists, "typed key was not delivered to the tapped column's page (title stayed 'k')")
    }
}
