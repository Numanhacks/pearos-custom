import QtQuick 2.15
import QtQuick.Controls 2.15
TextField {
    id: root; height: 22; placeholderText: "Search"
    font.family: "Inter"; font.pixelSize: 13
    background: Rectangle { radius: 5; color: "#FFFFFF"; border.color: "#D1D1D6"; border.width: 1 }
    leftPadding: 24
    Label { anchors.left: parent.left; anchors.leftMargin: 6; anchors.verticalCenter: parent.verticalCenter; text: "🔍"; font.pixelSize: 12; color: "#8E8E93" }
}
