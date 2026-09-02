import QtQuick 2.15
Rectangle {
    property alias blurBehind: root.blurEnabled
    property bool blurEnabled: true
    id: root; color: "#AFFFFFFF"; radius: 10
    border.color: "#33FFFFFF"; border.width: 1
    // Top highlight
    Rectangle { anchors.top: parent.top; width: parent.width; height: 1; color: "#33FFFFFF"; radius: parent.radius }
}
