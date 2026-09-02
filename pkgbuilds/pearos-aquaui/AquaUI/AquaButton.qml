import QtQuick 2.15
import QtQuick.Controls 2.15

Button {
    id: root
    property bool primary: false
    property int btnSize: 28 // 20 small, 28 regular, 32 large
    height: btnSize
    font.family: "Inter"; font.pixelSize: 13; font.weight: Font.Medium
    background: Rectangle {
        radius: 6; border.width: 1
        border.color: root.primary ? "#007AFF" : "#D1D1D6"
        gradient: Gradient {
            GradientStop { position: 0; color: root.primary ? "#007AFF" : "#FFFFFF" }
            GradientStop { position: 1; color: root.primary ? "#0066CC" : "#F5F5F7" }
        }
        opacity: root.hovered ? 0.92 : 1.0
        Behavior on opacity { NumberAnimation { duration: 80 } }
    }
    contentItem: Text {
        text: root.text; color: root.primary ? "white" : "#1D1D1F"
        horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter
        font: root.font; elide: Text.ElideRight
    }
}
