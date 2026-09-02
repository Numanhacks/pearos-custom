import QtQuick 2.15
import QtQuick.Window 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Window {
    id: root
    width: 480; height: 360
    minimumWidth: 480; maximumWidth: 480
    minimumHeight: 360; maximumHeight: 360
    flags: Qt.Window | Qt.WindowCloseButtonHint
    color: "#F5F5F7"
    title: "About This Mac"

    // Glass background hint
    Rectangle { anchors.fill: parent; color: "#AFFFFFFF"; border.color: "#1A000000"; border.width: 1; radius: 10 }

    ColumnLayout {
        anchors.fill: parent; anchors.margins: 24; spacing: 12
        Image { source: "qrc:/PearAboutMac/src/Apple_logo_black.svg"; Layout.alignment: Qt.AlignHCenter; sourceSize.width: 64; sourceSize.height: 64; fillMode: Image.PreserveAspectFit; visible: status===Image.Ready }
        Label { text: "pearOS"; font.pixelSize: 22; font.weight: Font.Bold; font.family: "Inter"; color: "#000"; Layout.alignment: Qt.AlignHCenter }
        Label { text: pearosVersion; font.pixelSize: 12; color: "#8E8E93"; Layout.alignment: Qt.AlignHCenter }
        Rectangle { Layout.fillWidth: true; height: 1; color: "#E5E5EA" }
        GridLayout { columns: 2; columnSpacing: 12; rowSpacing: 6; Layout.fillWidth: true
            Label { text: "Model:"; color: "#8E8E93"; font.pixelSize: 12 } Label { text: hardwareModel; color: "#000"; font.pixelSize: 12; Layout.fillWidth: true; elide: Text.ElideRight }
            Label { text: "Processor:"; color: "#8E8E93"; font.pixelSize: 12 } Label { text: cpuModel; color: "#000"; font.pixelSize: 12; Layout.fillWidth: true; elide: Text.ElideRight }
            Label { text: "Memory:"; color: "#8E8E93"; font.pixelSize: 12 } Label { text: memModel; color: "#000"; font.pixelSize: 12 }
            Label { text: "Graphics:"; color: "#8E8E93"; font.pixelSize: 12 } Label { text: gpuModel; color: "#000"; font.pixelSize: 12; Layout.fillWidth: true; elide: Text.ElideRight }
            Label { text: "Serial:"; color: "#8E8E93"; font.pixelSize: 12 } Label { text: serialNumber; color: "#000"; font.pixelSize: 11; font.family: "monospace" }
        }
        Item { Layout.fillHeight: true }
        RowLayout { Layout.alignment: Qt.AlignHCenter; spacing: 12
            Button { text: "Software Update…"; onClicked: { Qt.createQmlObject('import QtQuick 2.0; import QtQuick.Controls 2.0; Timer { interval: 50; running: true; onTriggered: { var p = Qt.createQmlObject("import QtQuick 2.0; QtObject { }", parent); } }', root); var proc = Qt.createQmlObject('import QtQuick 2.0; QtObject {}', root); } }
            // Actual handler via QProcess in C++ would be better; placeholder launches terminal:
            Button { text: "System Report…"; enabled: false }
        }
        Label { text: "© 2026 pearOS — macOS-inspired, Arch-based."; font.pixelSize: 10; color: "#AEAEB2"; Layout.alignment: Qt.AlignHCenter }
    }
}
