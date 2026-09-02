import QtQuick 2.15
import QtQuick.Window 2.15
import QtQuick.Controls 2.15

ApplicationWindow {
    id: root
    property alias toolbar: toolbarLoader.sourceComponent
    property alias sidebar: sidebarLoader.sourceComponent
    color: "#F5F5F7"
    // Traffic lights — 12px circles at (16,18)
    header: Rectangle {
        height: 52; color: "#ECECEC"; border.color: "#D1D1D6"; border.width: 0
        Row { anchors.left: parent.left; anchors.leftMargin: 16; anchors.verticalCenter: parent.verticalCenter; spacing: 8
            Rectangle { width: 12; height: 12; radius: 6; color: "#FF5F56"; border.color: "#E0443E"; border.width: 1 }
            Rectangle { width: 12; height: 12; radius: 6; color: "#FFBD2E"; border.color: "#DEA123"; border.width: 1 }
            Rectangle { width: 12; height: 12; radius: 6; color: "#27C93F"; border.color: "#1AAB29"; border.width: 1 }
        }
        Label { anchors.centerIn: parent; text: root.title; font.family: "Inter"; font.pixelSize: 13; font.weight: Font.Medium; color: "#1D1D1F" }
    }
    Loader { id: toolbarLoader; anchors.top: parent.top; anchors.topMargin: 52; width: parent.width; height: item ? 38 : 0 }
    SplitView { anchors.fill: parent; anchors.topMargin: 52 + (toolbarLoader.item ? 38 : 0); Loader { id: sidebarLoader; SplitView.preferredWidth: 220 } }
}
