import 'package:flutter/material.dart';

/// AKE Ritmi renkleri (web tasarım token'larının değerleri; HTML/CSS kopyalanmadı).
class AkeRenk {
  static const kagit = Color(0xFFF8F5F0);
  static const kart = Color(0xFFFFFFFF);
  static const girinti = Color(0xFFF0EBE3);
  static const murekkep = Color(0xFF28232C);
  static const murekkep2 = Color(0xFF5C5560);
  static const cizgi = Color(0xFFE8E1D9);
  static const cizgiGuclu = Color(0xFF8A8290);
  static const mercan = Color(0xFFB73F36);
  static const mercanYumusak = Color(0xFFF9E5E1);
  static const dogru = Color(0xFF476650);
  static const dogruZemin = Color(0xFFE6EEE8);
  static const yanlis = Color(0xFF9E1B4B);
  static const yanlisZemin = Color(0xFFFBE9EE);
  static const uyari = Color(0xFF7A4300);
  static const uyariZemin = Color(0xFFFBEBD6);
}

ThemeData akeTema() {
  final sema = ColorScheme.fromSeed(seedColor: AkeRenk.mercan, brightness: Brightness.light).copyWith(
    primary: AkeRenk.mercan,
    onPrimary: Colors.white,
    surface: AkeRenk.kagit,
    onSurface: AkeRenk.murekkep,
    error: AkeRenk.yanlis,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: sema,
    scaffoldBackgroundColor: AkeRenk.kagit,
    appBarTheme: const AppBarTheme(
      backgroundColor: AkeRenk.kagit,
      foregroundColor: AkeRenk.murekkep,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        foregroundColor: AkeRenk.murekkep,
        side: const BorderSide(color: AkeRenk.cizgiGuclu),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AkeRenk.kart,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AkeRenk.cizgiGuclu)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AkeRenk.cizgiGuclu)),
    ),
    textTheme: ThemeData.light().textTheme.apply(bodyColor: AkeRenk.murekkep, displayColor: AkeRenk.murekkep),
  );
}

/// Kart görünümü (sürümler arası CardTheme farkına bağlı kalmamak için kendi kutumuz).
class KartKutu extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? renk;
  final Color? kenar;
  const KartKutu({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.renk, this.kenar});
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: padding,
        decoration: BoxDecoration(
          color: renk ?? AkeRenk.kart,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kenar ?? AkeRenk.cizgi),
        ),
        child: child,
      );
}
